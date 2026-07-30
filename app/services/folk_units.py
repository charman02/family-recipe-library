"""Folk / body / vessel units — the way people who never measure actually talk.

A folk unit names a *vessel* or a *gesture*, not a measurement: a soup spoon, a
pinch, a good splash, three fingers of water. The app exists to preserve these
verbatim rather than normalize them into grams, so scaling has to treat them
differently from cup/tbsp/g.

The distinction that matters for scaling is between two kinds of folk unit:

- COUNTABLE (`FOLK_UNITS`): the vessel is unknowable but the count is exact.
  "3 soup spoons" doubled genuinely is 6 soup spoons — a cook can do that.
- NON-LINEAR (`NON_LINEAR_UNITS`): the number describes a *geometry*, not a
  quantity, so no multiplier applies. "3 fingers of water" is a depth in the
  pot; double the rice and the pot is wider, so the depth barely changes.
  Doubling the number gives you soup.

Keep this vocabulary in sync with `frontend/src/utils/quantity.js`, which uses
the same list to classify an amount as imprecise at entry time.
"""

# Depth, geometry, and body-relative measures. These never scale — the honest
# answer is the cook's own words plus the multiplier, so she can judge it the
# way she would standing at the stove.
NON_LINEAR_UNITS = {
    "finger",
    "fingers",
    "knuckle",
    "knuckles",
    "thumb",
    "thumbs",
    "fingertip",
    "fingertips",
}

# Vessels and gestures whose COUNT is real even though the amount is fuzzy.
# Singular -> plural, so a scaled amount reads like a person wrote it: "2 knobs
# of butter", not "2.0 knob of butter".
FOLK_PLURALS = {
    "soup spoon": "soup spoons",
    "spoonful": "spoonfuls",
    "rice cooker cup": "rice cooker cups",
    "wineglass": "wineglasses",
    "teacup": "teacups",
    "bowl": "bowls",
    "can": "cans",
    "jar": "jars",
    "packet": "packets",
    "pinch": "pinches",
    "handful": "handfuls",
    "fistful": "fistfuls",
    "glug": "glugs",
    "splash": "splashes",
    "dash": "dashes",
    "drizzle": "drizzles",
    "drop": "drops",
    "sprinkle": "sprinkles",
    "squeeze": "squeezes",
    "knob": "knobs",
    "lump": "lumps",
    "smidgen": "smidgens",
    "smidge": "smidges",
    "sliver": "slivers",
}

# Qualifiers that make a REAL unit fuzzy ("1 heaping tablespoon"). The unit still
# scales arithmetically, but the amount stays imprecise — the hedge is the point.
FOLK_QUALIFIERS = {"heaping", "heaped", "scant", "generous", "rounded", "level"}

_SINGULARS = set(FOLK_PLURALS)
_PLURALS = set(FOLK_PLURALS.values())


def _words(unit):
    return [w for w in "".join(c if c.isalnum() or c.isspace() else " " for c in unit.lower()).split()]


def is_non_linear(unit) -> bool:
    """True when the number describes a geometry that no multiplier can rescale."""
    if not unit:
        return False
    return any(w in NON_LINEAR_UNITS for w in _words(unit))


def find_countable_folk_unit(unit):
    """Return the folk unit found in `unit` as a (singular, plural) pair, else None.

    Matches on whole words so a real unit can't be caught by a folk substring —
    "tablespoon" must not match "spoon". Multi-word units ("soup spoon", "rice
    cooker cup") are checked first, since "soup spoon" also contains "spoon"-less
    words that a naive single-word scan would miss.
    """
    if not unit:
        return None
    text = " ".join(_words(unit))
    if not text:
        return None

    # Longest first: "rice cooker cup" must win before "cup" is ever considered,
    # and multi-word forms before their single-word parts.
    for singular in sorted(_SINGULARS | _PLURALS, key=len, reverse=True):
        if _contains_phrase(text, singular):
            if singular in _PLURALS:
                plural = singular
                singular = next(s for s, p in FOLK_PLURALS.items() if p == plural)
            else:
                plural = FOLK_PLURALS[singular]
            return singular, plural
    return None


def _contains_phrase(text: str, phrase: str) -> bool:
    words, target = text.split(), phrase.split()
    n = len(target)
    return any(words[i : i + n] == target for i in range(len(words) - n + 1))


def has_folk_qualifier(unit) -> bool:
    """True for a real unit wearing a fuzzy qualifier ("1 heaping tablespoon")."""
    if not unit:
        return False
    return any(w in FOLK_QUALIFIERS for w in _words(unit))


def pluralize_folk_unit(unit: str, count: float) -> str:
    """Swap the folk unit inside `unit` to the number-appropriate form.

    Only the folk word changes; anything around it ("of butter") is preserved, so
    "1 knob of butter" x2 becomes "2 knobs of butter".
    """
    found = find_countable_folk_unit(unit)
    if not found:
        return unit
    singular, plural = found
    want = singular if abs(count) == 1 else plural
    have = plural if _contains_phrase(" ".join(_words(unit)), plural) else singular
    if want == have:
        return unit
    return _replace_phrase(unit, have, want)


def _replace_phrase(unit: str, old: str, new: str) -> str:
    """Case-insensitive, word-boundary-aware replacement of the first occurrence."""
    lowered, old_words = unit.lower(), old.split()
    tokens, idx = unit.split(), None
    lowered_tokens = lowered.split()
    n = len(old_words)
    for i in range(len(lowered_tokens) - n + 1):
        # Compare with trailing punctuation stripped so "pinch," still matches.
        window = [t.strip(".,;:()") for t in lowered_tokens[i : i + n]]
        if window == old_words:
            idx = i
            break
    if idx is None:
        return unit
    return " ".join(tokens[:idx] + new.split() + tokens[idx + n :])
