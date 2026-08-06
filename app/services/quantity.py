"""Classify a written amount into the app's three-type quantity model, server-side.

`frontend/src/utils/quantity.js` has done this at entry time since the beginning, which
was enough while every amount arrived from a form field the user had typed. It isn't
enough now: `recipe_ai.py` receives amounts back from a language model, and those must be
typed by the app rather than by whatever the model felt like claiming. Sending them to
the browser to be classified and back again would put the model's output in charge of its
own grading.

Deliberately built on `folk_units`, the vocabulary `scaling.py` already uses, so a folk
amount is recognised identically whether it arrives from a form, a paste, or a model.
A second independent word list is how the two would eventually disagree about whether
"a good splash" scales — and that disagreement would show up as a wrong number in
someone's kitchen.

Keep the three-way meaning straight (it matches the frontend's):
  precise    — a real measurement that scales arithmetically: "200 g", "2 cups"
  imprecise  — a number that scales, in words that must not be converted:
               "3 soup spoons", "about 2 cups", "1 heaping tablespoon"
  unmeasured — no number to scale at all: "a good splash", "to taste", ""
"""

from __future__ import annotations

import re

from app.services.folk_units import (
    FOLK_QUALIFIERS,
    find_countable_folk_unit,
    is_non_linear,
)

# Hedges that make an otherwise-real amount imprecise. "~2 cups" and "about 2 cups"
# mean the same thing and neither is a claim of precision.
#
# Two patterns, not one, because the space is only required after a WORD: nobody writes
# "~ 2 cups". A single `(~|about|...)\s+` alternation typed "~2 cups" as precise, which
# is the exact class of bug this module exists to prevent — the frontend splits them the
# same way, and the two must agree.
_HEDGE = re.compile(
    r"^\s*(?:~\s*|(?:about|approx\.?|approximately|roughly|around)\s+)", re.I
)

# "1 1/2", "1/2", "1.5", "2" — mirrors parseLeadingNumber in the frontend.
_MIXED = re.compile(r"^(\d+)\s+(\d+)/(\d+)\b\s*(.*)$")
_FRACTION = re.compile(r"^(\d+)/(\d+)\b\s*(.*)$")
_DECIMAL = re.compile(r"^(\d*\.?\d+)\s*(.*)$")

_UNICODE_FRACTIONS = {
    "½": "1/2",
    "⅓": "1/3",
    "⅔": "2/3",
    "¼": "1/4",
    "¾": "3/4",
    "⅛": "1/8",
}


def _leading_number(text: str) -> tuple[float | None, str]:
    m = _MIXED.match(text)
    if m:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3)), m.group(4)
    m = _FRACTION.match(text)
    if m:
        return int(m.group(1)) / int(m.group(2)), m.group(3)
    m = _DECIMAL.match(text)
    if m:
        return float(m.group(1)), m.group(2)
    return None, text


def classify_amount(raw: str | None) -> dict:
    """Return the quantity_* fields for a written amount.

    Shaped to spread straight into an IngredientCreate payload.
    """
    text = (raw or "").strip()
    if not text:
        return {
            "quantity_text": None,
            "quantity_value": None,
            "unit": None,
            "quantity_type": "unmeasured",
        }

    normalized = text
    for glyph, ascii_form in _UNICODE_FRACTIONS.items():
        # "1½" → "1 1/2" but a standalone "½" → "1/2", so a mixed number doesn't
        # become "11/2".
        normalized = re.sub(
            rf"(\d)\s*{glyph}", rf"\1 {ascii_form}", normalized
        ).replace(glyph, ascii_form)

    hedged = bool(_HEDGE.match(normalized))
    working = _HEDGE.sub("", normalized)

    value, rest = _leading_number(working)
    unit = rest.strip() or None

    # Checked against the UNIT remainder, never the whole string, so an ingredient name
    # can't drag the type sideways — "a splash of splash-proof stock" shouldn't matter,
    # and more realistically neither should a name containing "can" or "drop".
    folk = bool(unit) and (
        find_countable_folk_unit(unit) is not None
        or is_non_linear(unit)
        or any(w in FOLK_QUALIFIERS for w in unit.lower().split())
    )

    if value is None:
        # No number: nothing to scale, whatever words are here. "a good splash",
        # "to taste", "a whole head of garlic" all land here — verbatim, forever.
        quantity_type = "unmeasured"
    elif hedged or folk:
        quantity_type = "imprecise"
    else:
        quantity_type = "precise"

    return {
        "quantity_text": text,
        "quantity_value": value,
        "unit": None if quantity_type == "unmeasured" else unit,
        "quantity_type": quantity_type,
    }
