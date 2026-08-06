"""Turn whatever someone says about a recipe into the app's fields, via an LLM.

WHY THIS EXISTS. The line-based parser in `frontend/src/lib/parseRecipeText.js` was
measured against four realistic inputs and failed one outright: dictated run-on prose.
"you need tamarind, about a thumb of ginger, and some kangkong" is a single line holding
three ingredients, and no line-based rule can split it. That's exactly how a person
talks when they're telling you how they cook — which is the input this app most exists
to capture. A language model splits it trivially.

WHAT IT MUST NOT DO is the whole design problem. The app's one claim is that a person's
own imprecise amounts survive: "3 soup spoons", "a good splash", "until it smells
right". An LLM's default behaviour is to be helpful by normalising — it will happily
turn "a good splash" into "2 tablespooons (30 ml)". That would delete the only part of
the recipe that was actually theirs, and it would be worse than no feature at all,
because it would be a lie about the recipe presented as an improvement. The prompt
forbids it, and `_clean` enforces it afterwards rather than trusting the instruction:
any amount the model returns is re-typed by the app's own classifier, and any ingredient
whose name the model didn't ground in the source text is dropped.

The caller is expected to fall back to the local parser when this raises. See
`routers/recipes.py::parse_recipe_text`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# A small, cheap, fast model is the right tool: this is extraction, not reasoning. The
# task is bounded and the schema is fixed, so paying for a frontier model would buy
# nothing a user could perceive. Overridable per-deploy without a code change.
DEFAULT_MODEL = "google/gemini-2.0-flash-001"

# The whole point of the app, stated as a rule rather than hoped for. Repeated in the
# schema description too, because a single instruction is easy for a model to drift from
# over a long input.
SYSTEM_PROMPT = """You extract recipes from how people actually talk about them.

Return ONLY a JSON object matching the schema. No prose, no markdown fences.

THE ONE RULE THAT MATTERS: preserve the cook's own words for amounts, exactly as
given. This app exists to keep imprecise measurements intact.
  · "3 soup spoons" stays "3 soup spoons" — never 45 ml, never 3 tablespoons
  · "a good splash" stays "a good splash" — never 2 tbsp
  · "a thumb of ginger" stays "a thumb" — never 15 g
  · "until it smells right" stays as written
NEVER convert, normalise, round, or add a unit that was not said. If no amount was
given for an ingredient, leave amount empty — do not invent one.

ONE EXCEPTION, and only this one: write a spoken count as a DIGIT. "three soup
spoons" becomes "3 soup spoons". Keep EVERY other word, including any hedge —
"about three cups" becomes "about 3 cups", never "3 cups", because dropping
"about" turns a guess into a measurement. "about a kilo" stays exactly as it is:
there is no count in it, "a" is an article. Only the numeral's spelling changes;
nothing is added, removed, or converted. It matters because a recipe with a real
count can be scaled up or down and a count spelled as a word cannot be.

Other rules:
  · Split run-on speech into separate ingredients. "you need tamarind, about a thumb
    of ginger, and some kangkong" is THREE ingredients.
  · Every ingredient name must appear in the input. Never add an ingredient the
    speaker didn't mention, even if the dish normally has it.
  · Steps in the order given, one action each, in the speaker's own voice. Don't
    add steps they didn't say.
  · A remark attached to a step ("don't crowd the pan", "this is the part people
    rush") goes in that step's note, not in its text.
  · servings only if a number was actually said. cuisine only if named or
    unmistakable from the dish name.
  · If the speaker says who the recipe came from, put that person in source_name,
    as the RECIPE'S OWNER would be named on a card. Strip the speaker's possessive:
    "my mom's sinigang" → "Mom", not "mom" and never "my mom". A relationship word
    IS a name when it's what they're called — "Mom", "Lola", "Auntie Ling" are all
    fine; capitalise it. Leave it empty rather than writing a phrase: not "my mom's
    friend", not "a recipe from work".
"""

# json_schema mode, not "please return JSON" — this is what makes the response shape
# reliable enough to skip defensive parsing of prose. OpenRouter passes it through to
# providers that support structured outputs.
RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "recipe",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "name",
                "source_name",
                "description",
                "servings",
                "cuisine",
                "ingredients",
                "steps",
            ],
            "properties": {
                "name": {"type": "string", "description": "The dish name."},
                "source_name": {
                    "type": "string",
                    "description": "Who the recipe came from, or empty.",
                },
                "description": {
                    "type": "string",
                    "description": "One short line about the dish, or empty.",
                },
                "servings": {
                    "type": "string",
                    "description": "Digits only, or empty if not stated.",
                },
                "cuisine": {"type": "string", "description": "Or empty."},
                "ingredients": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["name", "amount"],
                        "properties": {
                            "name": {"type": "string"},
                            "amount": {
                                "type": "string",
                                "description": (
                                    "VERBATIM as spoken. Empty if no amount was "
                                    "given. Never converted to a standard unit."
                                ),
                            },
                        },
                    },
                },
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["content", "note"],
                        "properties": {
                            "content": {"type": "string"},
                            "note": {
                                "type": "string",
                                "description": (
                                    "A remark or warning about this step, or empty."
                                ),
                            },
                        },
                    },
                },
            },
        },
    },
}


class RecipeAIUnavailable(RuntimeError):
    """The model could not be used, or returned something unusable.

    One exception type for every failure — missing key, timeout, HTTP error, malformed
    JSON — because the caller's response is the same in all of them: fall back to the
    local parser. Distinguishing them would only tempt a caller into handling some and
    forgetting others.
    """


def is_configured() -> bool:
    return bool(settings.openrouter_api_key)


async def extract_recipe(text: str, *, timeout: float = 25.0) -> dict[str, Any]:
    """Ask the model to structure `text`. Raises RecipeAIUnavailable on any failure."""
    if not is_configured():
        raise RecipeAIUnavailable("OPENROUTER_API_KEY is not set")

    body = {
        "model": settings.openrouter_model or DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "response_format": RESPONSE_SCHEMA,
        # Deterministic extraction. Creativity here would mean inventing ingredients.
        "temperature": 0,
        # NO REASONING. Measured, not assumed: with thinking on, DeepSeek V4 Flash took
        # 72.9s for one recipe; off, the same call took 5.9s for the same output. Hybrid
        # models think by default, and there is nothing here to think ABOUT — the task is
        # copying spans out of a sentence into a fixed schema. It also costs money:
        # reasoning tokens bill as output.
        #
        # Ignored by models without a reasoning mode, so this is safe for every model.
        "reasoning": {"enabled": False},
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    # OpenRouter uses these for attribution on its dashboard; harmless if unset.
    if settings.openrouter_referer:
        headers["HTTP-Referer"] = settings.openrouter_referer
    headers["X-Title"] = "issei"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(OPENROUTER_URL, json=body, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
        content = payload["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        # Logged at warning, not error: a fallback path exists and the user is served.
        logger.warning("recipe_ai: request failed (%s)", exc.__class__.__name__)
        raise RecipeAIUnavailable(str(exc)) from exc

    try:
        data = json.loads(_strip_fences(content))
    except json.JSONDecodeError as exc:
        logger.warning("recipe_ai: response was not JSON")
        raise RecipeAIUnavailable("model did not return JSON") from exc

    if not isinstance(data, dict):
        raise RecipeAIUnavailable("model returned a non-object")

    return _clean(data, source_text=text)


def _strip_fences(content: str) -> str:
    """Remove a ```json fence if the model added one despite being told not to."""
    s = (content or "").strip()
    if not s.startswith("```"):
        return s
    s = s.split("\n", 1)[-1] if "\n" in s else s
    if s.endswith("```"):
        s = s[: -3]
    return s.strip()


def _clean(data: dict[str, Any], *, source_text: str) -> dict[str, Any]:
    """Coerce the model's answer into the app's shape, and hold it to the one rule.

    Enforcement, not decoration. A prompt is a request; this is the part that makes the
    guarantee true even when the model ignores it.
    """
    # Imported here to keep the module importable without the heavier deps at collect
    # time, and because this is the only place it's needed.
    from app.services.quantity import classify_amount

    def s(key: str) -> str:
        v = data.get(key)
        return v.strip() if isinstance(v, str) else ""

    lowered = source_text.lower()

    ingredients = []
    for raw in data.get("ingredients") or []:
        if not isinstance(raw, dict):
            continue
        name = (raw.get("name") or "").strip()
        amount = (raw.get("amount") or "").strip()
        if not name:
            continue
        # GROUNDING CHECK. A model asked about "adobo" will helpfully add soy sauce and
        # bay leaves whether or not they were mentioned, and a recipe with ingredients
        # the cook never said is not their recipe any more. Requiring the head word to
        # appear in the source is a cheap, high-recall filter: real ingredient names are
        # quoted from the input, invented ones usually aren't.
        head = name.split()[-1].lower().rstrip("s")
        if head and head not in lowered:
            logger.info("recipe_ai: dropped ungrounded ingredient %r", name)
            continue
        ingredients.append(
            {"name": name, "amount": amount, **classify_amount(amount)}
        )

    steps = []
    for raw in data.get("steps") or []:
        if not isinstance(raw, dict):
            continue
        content = (raw.get("content") or "").strip()
        if not content:
            continue
        steps.append({"content": content, "note": (raw.get("note") or "").strip()})

    servings = s("servings")
    digits = "".join(ch for ch in servings if ch.isdigit())

    return {
        "name": s("name"),
        "source_name": s("source_name"),
        "description": s("description"),
        "servings": digits,
        "cuisine": s("cuisine"),
        "ingredients": ingredients,
        "steps": steps,
    }
