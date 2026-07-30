from app.models.ingredient import Ingredient
from app.services.folk_units import (
    find_countable_folk_unit,
    is_non_linear,
    pluralize_folk_unit,
)


def _tidy(value: float):
    """Drop a trailing ".0" — "6 soup spoons", never "6.0 soup spoons"."""
    return int(value) if float(value).is_integer() else value


def scale_ingredient(ingredient: Ingredient, multiplier: float) -> dict:
    scaled_ing = {
        "id": ingredient.id,
        "name": ingredient.name,
        "quantity_text": ingredient.quantity_text,
        "quantity_value": ingredient.quantity_value,
        "unit": ingredient.unit,
        "quantity_type": ingredient.quantity_type,
        "notes": ingredient.notes,
        "position": ingredient.position,
        # Set only when the amount was deliberately NOT scaled: the cook keeps her
        # own words and gets the multiplier to apply by feel.
        "scale_note": None,
    }

    if ingredient.quantity_value is not None:
        # "precise" with a unit (measurable)
        if ingredient.quantity_type == "precise" and ingredient.unit:
            scaled_value = round(ingredient.quantity_value * multiplier, 2)
            scaled_ing["quantity_text"] = f"{scaled_value} {ingredient.unit}"
            scaled_ing["quantity_value"] = scaled_value

        # "precise" without a unit (countable)
        elif ingredient.quantity_type == "precise" and not ingredient.unit:
            scaled_value = round(ingredient.quantity_value * multiplier)
            scaled_ing["quantity_text"] = str(scaled_value)
            scaled_ing["quantity_value"] = scaled_value

        # "imprecise" with a value — the interesting case. A folk unit names a
        # vessel or a gesture, so multiplying it is only honest when the result is
        # still something a person could DO in a kitchen.
        elif ingredient.quantity_type == "imprecise":
            _scale_imprecise(ingredient, multiplier, scaled_ing)

    # "imprecise" without value or "unmeasured": return unchanged
    return scaled_ing


def _scale_imprecise(ingredient: Ingredient, multiplier: float, scaled_ing: dict) -> None:
    unit = ingredient.unit or ""

    # A depth or body-relative measure has no multiplier at all: "3 fingers of
    # water" is how high the water sits above the rice, and a bigger batch sits in
    # a wider pot. Doubling the number would give you soup.
    if is_non_linear(unit):
        _keep_verbatim(ingredient, multiplier, scaled_ing)
        return

    if find_countable_folk_unit(unit):
        scaled_value = ingredient.quantity_value * multiplier
        # A fractional count of a vessel isn't an instruction anyone can follow —
        # there is no half-pinch, and you can't buy 1.5 cans. Rather than invent
        # one, hand back her words and the multiplier.
        if not float(scaled_value).is_integer():
            _keep_verbatim(ingredient, multiplier, scaled_ing)
            return
        count = _tidy(scaled_value)
        scaled_ing["quantity_text"] = f"{count} {pluralize_folk_unit(unit, count)}".strip()
        scaled_ing["quantity_value"] = count
        return

    # A hedged real unit ("about 1 tsp", "1 heaping tablespoon"): the arithmetic
    # holds, but the result stays marked approximate rather than posing as a
    # precise measurement.
    scaled_value = round(ingredient.quantity_value * multiplier, 2)
    unit_str = f" {unit}" if unit else ""
    scaled_ing["quantity_text"] = f"{_tidy(scaled_value)}{unit_str} (approximate)"
    scaled_ing["quantity_value"] = scaled_value


def _keep_verbatim(ingredient: Ingredient, multiplier: float, scaled_ing: dict) -> None:
    """Her words, untouched, plus the multiplier to apply by feel."""
    scaled_ing["quantity_text"] = ingredient.quantity_text
    scaled_ing["quantity_value"] = ingredient.quantity_value
    if multiplier != 1:
        scaled_ing["scale_note"] = f"×{_tidy(multiplier)}"
