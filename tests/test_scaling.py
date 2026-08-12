from app.services.scaling import scale_ingredient
from app.models.ingredient import Ingredient


def test_precise_with_unit():
    ingredient = Ingredient(
        name="soy sauce",
        quantity_text="3 tbsp",
        quantity_value=3,
        unit="tbsp",
        quantity_type="precise",
    )
    scaled_ing = scale_ingredient(ingredient, 2)
    assert scaled_ing["quantity_text"] == "6 tbsp"
    assert scaled_ing["quantity_value"] == 6


def test_precise_without_unit():
    ingredient = Ingredient(
        name="eggs",
        quantity_text="3",
        quantity_value=3,
        unit=None,
        quantity_type="precise",
    )
    scaled_ing = scale_ingredient(ingredient, 1.5)
    assert scaled_ing["quantity_value"] == 4  # banker's rounding (rounds to nearest even)
    assert scaled_ing["unit"] is None


def test_imprecise_with_value():
    ingredient = Ingredient(
        name="olive oil",
        quantity_text="about 1 tsp",
        quantity_value=1,
        unit="tsp",
        quantity_type="imprecise",
    )
    scaled_ing = scale_ingredient(ingredient, 4)
    assert "approximate" in scaled_ing["quantity_text"]
    assert scaled_ing["quantity_value"] == 4


def test_imprecise_without_value():
    ingredient = Ingredient(
        name="vinegar",
        quantity_text="a dash",
        quantity_type="imprecise",
    )
    scaled_ing = scale_ingredient(ingredient, 3)
    # The words never change — there's no number to multiply.
    assert scaled_ing["quantity_text"] == "a dash"
    assert scaled_ing["quantity_value"] is None
    # ...but the cook is still told the batch tripled, via the multiplier note.
    assert scaled_ing["scale_note"] == "×3"


def test_unmeasured_shows_the_multiplier_but_keeps_the_words():
    ingredient = Ingredient(
        name="salt",
        quantity_text="to taste",
        quantity_type="unmeasured",
    )
    scaled_ing = scale_ingredient(ingredient, 2.5)
    assert scaled_ing["quantity_text"] == "to taste"
    assert scaled_ing["quantity_value"] is None
    # "a good splash" doubled is still a good splash — but at 2.5× the cook should
    # know the batch grew, so the yellow ×N tag renders beside the verbatim words.
    assert scaled_ing["scale_note"] == "×2.5"


def test_unmeasured_has_no_multiplier_at_one_x():
    # At the recipe's own serving count nothing is scaled, so no tag appears.
    ingredient = Ingredient(
        name="salt",
        quantity_text="to taste",
        quantity_type="unmeasured",
    )
    scaled_ing = scale_ingredient(ingredient, 1)
    assert scaled_ing["quantity_text"] == "to taste"
    assert scaled_ing["scale_note"] is None


# --- folk / body / vessel units: the hybrid rule ---
#
# A folk unit names a vessel or a gesture, not a measurement, so multiplying it
# is only honest when the result is still something a person could DO. The rule:
# scale the count when it lands on a whole number AND the unit scales linearly;
# otherwise keep the cook's words verbatim and show the multiplier instead.


def _folk(text, value, unit):
    return Ingredient(
        name="x",
        quantity_text=text,
        quantity_value=value,
        unit=unit,
        quantity_type="imprecise",
    )


def test_countable_folk_unit_scales_to_a_whole_number():
    """"3 soup spoons" doubled really is 6 soup spoons — the vessel is unknowable
    but the COUNT is exact, so the arithmetic is honest and useful."""
    scaled = scale_ingredient(_folk("3 soup spoons", 3, "soup spoons"), 2)
    assert scaled["quantity_text"] == "6 soup spoons"
    assert scaled["quantity_value"] == 6
    # no machine residue: no ".0", no "(approximate)"
    assert ".0" not in scaled["quantity_text"]
    assert "approximate" not in scaled["quantity_text"]


def test_a_fractional_folk_count_is_kept_verbatim_with_the_multiplier():
    """There is no such thing as 7.5 soup spoons. Rather than invent one, hand the
    cook her own words and the multiplier, and let her do what she'd do."""
    scaled = scale_ingredient(_folk("3 soup spoons", 3, "soup spoons"), 2.5)
    assert scaled["quantity_text"] == "3 soup spoons"
    assert scaled["quantity_value"] == 3
    assert scaled["scale_note"] == "×2.5"


def test_a_half_pinch_is_never_invented():
    scaled = scale_ingredient(_folk("1 pinch", 1, "pinch"), 1.5)
    assert scaled["quantity_text"] == "1 pinch"
    assert scaled["scale_note"] == "×1.5"


def test_a_whole_multiple_of_a_pinch_does_scale():
    scaled = scale_ingredient(_folk("1 pinch", 1, "pinch"), 3)
    assert scaled["quantity_text"] == "3 pinches"


def test_non_linear_measures_are_never_scaled():
    """"3 fingers of water" is a DEPTH in the pot. Double the rice and the pot is
    wider, so the depth barely changes — doubling the number gives you soup. No
    multiplier can express this, so the only honest answer is her own words."""
    scaled = scale_ingredient(_folk("3 fingers of water", 3, "fingers of water"), 2)
    assert scaled["quantity_text"] == "3 fingers of water"
    assert scaled["quantity_value"] == 3
    assert scaled["scale_note"] == "×2"


def test_non_linear_measures_stay_verbatim_even_on_a_clean_multiple():
    """A whole-number multiple is no excuse — the geometry is what breaks, not the
    arithmetic."""
    scaled = scale_ingredient(_folk("2 fingers", 2, "fingers"), 4)
    assert scaled["quantity_text"] == "2 fingers"
    assert scaled["scale_note"] == "×4"


def test_a_scaled_folk_unit_is_pluralized():
    """"2.0 knob of butter" reads machine-generated at exactly the moment the app
    is claiming to preserve someone's voice."""
    scaled = scale_ingredient(_folk("1 knob of butter", 1, "knob of butter"), 2)
    assert scaled["quantity_text"] == "2 knobs of butter"


def test_an_already_plural_folk_unit_is_not_double_pluralized():
    scaled = scale_ingredient(_folk("2 handfuls", 2, "handfuls"), 2)
    assert scaled["quantity_text"] == "4 handfuls"


def test_scaling_back_down_to_one_uses_the_singular():
    scaled = scale_ingredient(_folk("2 handfuls", 2, "handfuls"), 0.5)
    assert scaled["quantity_text"] == "1 handful"


def test_hedged_real_units_keep_their_hedge_and_stay_approximate():
    """"about 1 tsp" is a real unit with a hedge — the number still scales, but the
    result must stay marked as approximate rather than posing as precise."""
    ing = Ingredient(
        name="olive oil",
        quantity_text="about 1 tsp",
        quantity_value=1,
        unit="tsp",
        quantity_type="imprecise",
    )
    scaled = scale_ingredient(ing, 4)
    assert "4" in scaled["quantity_text"]
    assert "approximate" in scaled["quantity_text"]


def test_no_scale_note_when_the_amount_actually_scaled():
    scaled = scale_ingredient(_folk("3 soup spoons", 3, "soup spoons"), 2)
    assert scaled.get("scale_note") is None


def test_multiplier_of_one_changes_nothing():
    scaled = scale_ingredient(_folk("3 soup spoons", 3, "soup spoons"), 1)
    assert scaled["quantity_text"] == "3 soup spoons"
    assert scaled.get("scale_note") is None


def test_scale_note_survives_the_api_boundary():
    """A `scale_note` the response schema silently dropped would leave the UI with
    her verbatim words and no hint that a multiplier applies — worse than either
    choice, since the amount would look like it needed no adjustment at all."""
    from app.schemas.recipe import IngredientResponse

    ing = _folk("3 soup spoons", 3, "soup spoons")
    ing.id, ing.position = 1, 1
    scaled = scale_ingredient(ing, 2.5)
    out = IngredientResponse.model_validate(scaled)
    assert out.quantity_text == "3 soup spoons"
    assert out.scale_note == "×2.5"


def test_scale_note_is_absent_on_an_unscaled_read():
    """The field must default to None everywhere else, so a normal recipe read
    doesn't start advertising a multiplier."""
    from app.schemas.recipe import IngredientResponse

    out = IngredientResponse.model_validate(
        {"id": 1, "name": "soy sauce", "quantity_type": "precise", "position": 1}
    )
    assert out.scale_note is None


def test_the_backend_and_frontend_folk_vocabularies_agree():
    """The two halves of the promise live in different languages: the frontend
    classifies an amount as "their way" at entry (frontend/src/utils/quantity.js),
    the backend decides how it scales (app/services/folk_units.py). A unit known to
    one but not the other breaks the promise in the middle — tagged as hers, then
    silently multiplied. Parse the JS list and diff it, so drift fails a test
    instead of shipping.
    """
    import re
    from pathlib import Path
    from app.services.folk_units import FOLK_PLURALS, FOLK_QUALIFIERS, NON_LINEAR_UNITS

    js = Path(__file__).resolve().parents[1] / "frontend" / "src" / "utils" / "quantity.js"
    block = re.search(r"const FOLK_UNITS = \[(.*?)\]", js.read_text(encoding="utf-8"), re.S)
    assert block, "FOLK_UNITS array not found — did quantity.js move or get renamed?"
    frontend = {m.group(1) for m in re.finditer(r"'([^']+)'", block.group(1))}

    backend = (
        set(FOLK_PLURALS) | set(FOLK_PLURALS.values()) | FOLK_QUALIFIERS | NON_LINEAR_UNITS
    )
    missing_in_backend = frontend - backend
    assert not missing_in_backend, (
        "these units are tagged imprecise at entry but the backend would still "
        f"scale them arithmetically: {sorted(missing_in_backend)}"
    )
