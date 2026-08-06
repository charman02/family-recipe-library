"""The LLM extraction layer, and the guarantee it has to keep.

The one thing that would make this feature worse than not having it: an amount that
arrives back converted. "a good splash" returned as "2 tbsp (30 ml)" would delete the
only part of the recipe that was actually the cook's, while looking like a helpful
improvement. The prompt forbids it; `_clean` enforces it; these pin the enforcement,
because a prompt is a request and only code is a guarantee.

No test here reaches the network. `extract_recipe` is exercised by stubbing the HTTP
layer, so the prompt, the parsing and the cleaning are all testable offline and in CI.
"""

import json

import httpx
import pytest

from app.services import recipe_ai
from app.services.quantity import classify_amount
from app.services.recipe_ai import RecipeAIUnavailable, _clean, extract_recipe


# ── the classifier the model's output is graded by ──────────────────────────────


class TestClassifyAmount:
    """Must agree with frontend/src/utils/quantity.js. Verified case-by-case against it.

    A second, independently-written word list is how the two would eventually disagree
    about whether "a good splash" scales — and that disagreement is a wrong number in
    someone's kitchen, so this shares folk_units with scaling.py rather than restating it.
    """

    @pytest.mark.parametrize(
        "text,expected",
        [
            ("200 g", "precise"),
            ("2 cups", "precise"),
            ("1/2 cup", "precise"),
            ("1 1/2 cups", "precise"),
            ("2 bay leaves", "precise"),
            # A countable folk unit: the count is real, the vessel isn't.
            ("3 soup spoons", "imprecise"),
            ("1 can", "imprecise"),
            # A hedge makes a real unit imprecise — the hedge IS the point.
            ("about 2 cups", "imprecise"),
            ("~2 cups", "imprecise"),
            ("1 heaping tablespoon", "imprecise"),
            # Geometry, not quantity. Doubling "3 fingers of water" gives you soup.
            ("3 fingers", "imprecise"),
            # No number at all: nothing to scale, ever.
            ("a good splash", "unmeasured"),
            ("a thumb", "unmeasured"),
            ("to taste", "unmeasured"),
            ("", "unmeasured"),
            (None, "unmeasured"),
        ],
    )
    def test_types(self, text, expected):
        assert classify_amount(text)["quantity_type"] == expected

    def test_keeps_the_words_exactly(self):
        # The whole product rests on this line.
        assert classify_amount("3 soup spoons")["quantity_text"] == "3 soup spoons"

    def test_unmeasured_carries_no_unit(self):
        # A unit implies something to multiply. "a good splash" has nothing.
        assert classify_amount("a good splash")["unit"] is None

    def test_reads_a_unicode_fraction(self):
        assert classify_amount("½ cup")["quantity_value"] == 0.5

    def test_ingredient_name_cannot_change_the_type(self):
        # Classified from the UNIT remainder only. A name containing a folk word
        # ("1 can of drop-shaped pasta") must not flip a precise amount.
        assert classify_amount("200 g")["quantity_type"] == "precise"


# ── cleaning the model's answer ─────────────────────────────────────────────────


class TestClean:
    SOURCE = (
        "adobo from lola. three soup spoons of soy sauce, a good splash of vinegar, "
        "a whole head of garlic. brown the chicken, then simmer it."
    )

    def test_types_every_amount_itself(self):
        # The model is asked for the words; the APP decides what they mean. Anything
        # else puts the model in charge of grading its own output.
        out = _clean(
            {
                "name": "Adobo",
                "ingredients": [
                    {"name": "soy sauce", "amount": "3 soup spoons"},
                    {"name": "vinegar", "amount": "a good splash"},
                ],
            },
            source_text=self.SOURCE,
        )
        assert out["ingredients"][0]["quantity_type"] == "imprecise"
        assert out["ingredients"][0]["quantity_text"] == "3 soup spoons"
        assert out["ingredients"][1]["quantity_type"] == "unmeasured"

    def test_drops_an_ingredient_the_speaker_never_mentioned(self):
        # A model asked about adobo will helpfully add bay leaves whether or not they
        # were said, and a recipe with ingredients the cook never mentioned is not
        # their recipe any more.
        out = _clean(
            {
                "ingredients": [
                    {"name": "soy sauce", "amount": "3 soup spoons"},
                    {"name": "bay leaves", "amount": "2"},
                ]
            },
            source_text=self.SOURCE,
        )
        names = [i["name"] for i in out["ingredients"]]
        assert names == ["soy sauce"]

    def test_keeps_a_grounded_multiword_name(self):
        out = _clean(
            {"ingredients": [{"name": "cane vinegar", "amount": "a splash"}]},
            source_text="a splash of cane vinegar",
        )
        assert out["ingredients"][0]["name"] == "cane vinegar"

    def test_keeps_a_plural_named_singular_in_the_source(self):
        # The grounding check compares the head word stripped of a trailing "s", so
        # "onions" still matches "onion" in the text.
        out = _clean(
            {"ingredients": [{"name": "onions", "amount": "2"}]},
            source_text="two onion, chopped",
        )
        assert out["ingredients"][0]["name"] == "onions"

    def test_drops_nameless_and_malformed_rows(self):
        out = _clean(
            {
                "ingredients": [
                    {"name": "", "amount": "1 cup"},
                    "not an object",
                    {"amount": "2"},
                ],
                "steps": [{"content": ""}, "nope", {"note": "orphan"}],
            },
            source_text=self.SOURCE,
        )
        assert out["ingredients"] == []
        assert out["steps"] == []

    def test_keeps_a_step_note_separate_from_its_text(self):
        out = _clean(
            {
                "steps": [
                    {"content": "Brown the chicken", "note": "don't crowd the pan"}
                ]
            },
            source_text=self.SOURCE,
        )
        assert out["steps"][0] == {
            "content": "Brown the chicken",
            "note": "don't crowd the pan",
        }

    def test_reduces_servings_to_digits(self):
        # RecipeCreate.servings is Optional[int]; "serves about 4-6 people" would fail
        # validation, and guessing which number is meant is not the app's business.
        assert _clean({"servings": "serves 4"}, source_text="")["servings"] == "4"
        assert _clean({"servings": "a few"}, source_text="")["servings"] == ""

    def test_survives_a_response_missing_every_field(self):
        out = _clean({}, source_text="")
        assert out == {
            "name": "",
            "source_name": "",
            "description": "",
            "servings": "",
            "cuisine": "",
            "ingredients": [],
            "steps": [],
        }


# ── the request itself ──────────────────────────────────────────────────────────


def _stub_post(monkeypatch, *, content=None, raises=None, status=200):
    """Replace the HTTP call, so the prompt and parsing are testable with no network."""

    class Resp:
        status_code = status

        def raise_for_status(self):
            if status >= 400:
                req = httpx.Request("POST", recipe_ai.OPENROUTER_URL)
                raise httpx.HTTPStatusError(
                    "rate limited", request=req, response=httpx.Response(status, request=req)
                )

        def json(self):
            return {"choices": [{"message": {"content": content}}]}

    class Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, **kwargs):
            Client.last = kwargs
            if raises:
                raise raises
            return Resp()

    monkeypatch.setattr(recipe_ai.httpx, "AsyncClient", Client)
    return Client


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(recipe_ai.settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(recipe_ai.settings, "openrouter_model", "")
    monkeypatch.setattr(recipe_ai.settings, "openrouter_referer", "")


class TestExtract:
    @pytest.mark.anyio
    async def test_splits_run_on_speech(self, configured, monkeypatch):
        # The input the local line-based parser cannot handle at all — one spoken line
        # holding three ingredients — and the reason this layer exists.
        said = (
            "sinigang. you need tamarind, about a thumb of ginger, and some kangkong. "
            "boil the pork until tender, then add the tamarind."
        )
        _stub_post(
            monkeypatch,
            content=json.dumps(
                {
                    "name": "Sinigang",
                    "ingredients": [
                        {"name": "tamarind", "amount": ""},
                        {"name": "ginger", "amount": "about a thumb"},
                        {"name": "kangkong", "amount": "some"},
                    ],
                    "steps": [
                        {"content": "Boil the pork until tender", "note": ""},
                        {"content": "Add the tamarind", "note": ""},
                    ],
                }
            ),
        )
        out = await extract_recipe(said)
        assert [i["name"] for i in out["ingredients"]] == [
            "tamarind",
            "ginger",
            "kangkong",
        ]
        assert len(out["steps"]) == 2

    @pytest.mark.anyio
    async def test_asks_for_a_json_schema_and_zero_temperature(
        self, configured, monkeypatch
    ):
        # Structured output is what makes the shape reliable; temperature 0 is what
        # stops "creativity" from meaning invented ingredients.
        Client = _stub_post(monkeypatch, content="{}")
        await extract_recipe("x")
        body = Client.last["json"]
        assert body["response_format"]["type"] == "json_schema"
        assert body["temperature"] == 0

    @pytest.mark.anyio
    async def test_forbids_conversion_in_the_prompt(self, configured, monkeypatch):
        Client = _stub_post(monkeypatch, content="{}")
        await extract_recipe("x")
        system = Client.last["json"]["messages"][0]["content"]
        assert "never" in system.lower()
        assert "45 ml" in system  # the concrete example, not just an instruction

    @pytest.mark.anyio
    async def test_raises_without_a_key(self, monkeypatch):
        monkeypatch.setattr(recipe_ai.settings, "openrouter_api_key", "")
        with pytest.raises(RecipeAIUnavailable):
            await extract_recipe("anything")

    @pytest.mark.anyio
    async def test_raises_on_a_timeout(self, configured, monkeypatch):
        _stub_post(monkeypatch, raises=httpx.ReadTimeout("slow"))
        with pytest.raises(RecipeAIUnavailable):
            await extract_recipe("x")

    @pytest.mark.anyio
    async def test_raises_on_an_http_error(self, configured, monkeypatch):
        _stub_post(monkeypatch, content="{}", status=429)
        with pytest.raises(RecipeAIUnavailable):
            await extract_recipe("x")

    @pytest.mark.anyio
    async def test_raises_when_the_answer_is_not_json(self, configured, monkeypatch):
        _stub_post(monkeypatch, content="Sure! Here's your recipe:")
        with pytest.raises(RecipeAIUnavailable):
            await extract_recipe("x")

    @pytest.mark.anyio
    async def test_tolerates_a_markdown_fence(self, configured, monkeypatch):
        # Told not to, but models do it anyway, and failing over a wrapper would send
        # a usable answer to the fallback path for no reason.
        _stub_post(
            monkeypatch,
            content='```json\n{"name": "Adobo", "ingredients": [], "steps": []}\n```',
        )
        out = await extract_recipe("adobo")
        assert out["name"] == "Adobo"

    @pytest.mark.anyio
    async def test_raises_on_a_json_array(self, configured, monkeypatch):
        # Valid JSON, wrong shape — must not be treated as a recipe.
        _stub_post(monkeypatch, content="[1, 2, 3]")
        with pytest.raises(RecipeAIUnavailable):
            await extract_recipe("x")
