"""POST /recipes/parse — the HTTP surface of the LLM extraction layer.

The behaviour that matters most here is what happens when the model ISN'T available.
This endpoint costs money per call and depends on a third party, so the app has to keep
working without it: /add worked before this existed and must keep working when
OpenRouter is down, out of credit, or simply unconfigured. Every failure returns
ai=False with empty fields, and the client falls back to the line-based parser it
already ships.

Nothing here reaches the network — recipe_ai.extract_recipe is stubbed.
"""

import pytest

from app.services import recipe_ai
from app.services.recipe_ai import RecipeAIUnavailable


SAID = (
    "sinigang from my lola. you need tamarind, about a thumb of ginger, and some "
    "kangkong. boil the pork until tender, then add the tamarind. don't overcook "
    "the greens."
)


@pytest.fixture
def ai_returns(monkeypatch):
    """Stub the model with a fixed answer."""

    def _install(data):
        async def fake(text, **kwargs):
            return data

        monkeypatch.setattr(recipe_ai, "extract_recipe", fake)
        # The router imported the symbol directly, so patch it there too.
        import app.routers.recipes as recipes_router

        monkeypatch.setattr(recipes_router, "extract_recipe", fake)

    return _install


@pytest.fixture
def ai_fails(monkeypatch):
    def _install(exc=RecipeAIUnavailable("no key")):
        async def fake(text, **kwargs):
            raise exc

        monkeypatch.setattr(recipe_ai, "extract_recipe", fake)
        import app.routers.recipes as recipes_router

        monkeypatch.setattr(recipes_router, "extract_recipe", fake)

    return _install


FULL = {
    "name": "Sinigang",
    "source_name": "Lola",
    "description": "Sour pork soup.",
    "servings": "4",
    "cuisine": "Filipino",
    "ingredients": [
        {
            "name": "tamarind",
            "amount": "",
            "quantity_text": None,
            "quantity_value": None,
            "unit": None,
            "quantity_type": "unmeasured",
        },
        {
            "name": "ginger",
            "amount": "about a thumb",
            "quantity_text": "about a thumb",
            "quantity_value": None,
            "unit": None,
            "quantity_type": "unmeasured",
        },
    ],
    "steps": [
        {"content": "Boil the pork until tender", "note": ""},
        {"content": "Add the tamarind", "note": "don't overcook the greens"},
    ],
}


def test_structures_what_was_said(client, make_user, ai_returns):
    _, headers = make_user()
    ai_returns(FULL)

    r = client.post("/recipes/parse", json={"text": SAID}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["ai"] is True
    assert body["name"] == "Sinigang"
    assert body["source_name"] == "Lola"
    assert [i["name"] for i in body["ingredients"]] == ["tamarind", "ginger"]
    # The step remark stays attached to its step rather than being folded into the text.
    assert body["steps"][1]["note"] == "don't overcook the greens"


def test_saves_nothing(client, make_user, ai_returns):
    # The model is allowed to be wrong, so it must not be allowed to write. The client
    # shows the result for correction and the user submits the form as usual.
    _, headers = make_user()
    ai_returns(FULL)

    client.post("/recipes/parse", json={"text": SAID}, headers=headers)
    assert client.get("/recipes", headers=headers).json() == []


def test_reports_ai_false_rather_than_failing_when_unavailable(
    client, make_user, ai_fails
):
    # THE test. No key, a timeout, a 429, malformed JSON — all the same to the caller,
    # and none of them may break /add. A 500 here would turn a missing API key into a
    # broken feature.
    _, headers = make_user()
    ai_fails()

    r = client.post("/recipes/parse", json={"text": SAID}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["ai"] is False
    assert body["ingredients"] == []
    assert body["steps"] == []
    assert body["name"] == ""


def test_requires_a_signed_in_user(client):
    # It spends money per call, so it must not be reachable by anyone who finds the URL,
    # even though it touches no rows.
    r = client.post("/recipes/parse", json={"text": SAID})
    assert r.status_code in (401, 403)


def test_rejects_empty_text(client, make_user):
    _, headers = make_user()
    r = client.post("/recipes/parse", json={"text": ""}, headers=headers)
    assert r.status_code == 422


def test_rejects_text_far_longer_than_any_recipe(client, make_user):
    # Bounded so a paste can't become an unbounded prompt, and so one request's token
    # cost stays predictable.
    _, headers = make_user()
    r = client.post("/recipes/parse", json={"text": "x" * 9000}, headers=headers)
    assert r.status_code == 422


def test_is_not_shadowed_by_the_recipe_id_route(client, make_user, ai_returns):
    # /recipes/{recipe_id} is declared in the same router. If "/parse" were registered
    # after it, this would try to look up a recipe named "parse".
    _, headers = make_user()
    ai_returns(FULL)
    r = client.post("/recipes/parse", json={"text": SAID}, headers=headers)
    assert r.status_code == 200


def test_result_can_be_saved_through_the_normal_create_path(
    client, make_user, ai_returns
):
    # The parse output has to be usable as-is: its ingredient rows carry the same
    # quantity_* fields RecipeCreate expects, so a client can post them straight back
    # without a translation layer that could drop the typing.
    _, headers = make_user()
    ai_returns(FULL)
    parsed = client.post("/recipes/parse", json={"text": SAID}, headers=headers).json()

    payload = {
        "name": parsed["name"],
        "visibility": "private",
        "ingredients": [
            {
                "name": i["name"],
                "quantity_text": i["quantity_text"],
                "quantity_value": i["quantity_value"],
                "unit": i["unit"],
                "quantity_type": i["quantity_type"],
                "position": n + 1,
            }
            for n, i in enumerate(parsed["ingredients"])
        ],
        "steps": [
            {"content": s["content"], "voice_note": s["note"] or None, "position": n + 1}
            for n, s in enumerate(parsed["steps"])
        ],
    }
    created = client.post("/recipes", json=payload, headers=headers)
    assert created.status_code == 201
    saved = created.json()
    assert saved["name"] == "Sinigang"
    assert len(saved["ingredients"]) == 2
    # And the imprecision survived the round trip.
    assert saved["ingredients"][1]["quantity_text"] == "about a thumb"
