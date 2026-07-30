from typing import Optional
from app.schemas.shopping_list import ShoppingListItem
from app.services.units import convert


def format_amount(value: Optional[float], unit: Optional[str]) -> str:
    """Render a numeric amount the way a person writes it on a list — no trailing
    ".0" on whole numbers, since "3.0 cup" reads as a machine's arithmetic."""
    if value is None:
        return ""
    number = int(value) if float(value).is_integer() else value
    return f"{number} {unit}" if unit else f"{number}"


def ingredient_amount(ingredient) -> str:
    """The amount as it should read on the list: the cook's own words when they
    typed any ("a good splash" IS the amount here), else the parsed number.

    The fallback matters because quantity_text is optional at the API boundary —
    without it a numeric-only ingredient contributed nothing, or the literal
    string "None", to a consolidated line.
    """
    return ingredient.quantity_text or format_amount(
        ingredient.quantity_value, ingredient.unit
    )


def join_amounts(existing: str, addition: str) -> str:
    """Amounts that can't be summed sit side by side. Both sides need guarding: an
    empty running text must not inherit a leading " + ", and an amountless
    ingredient (an "unmeasured" pinch of salt) must not leave a dangling one."""
    if not addition:
        return existing
    if not existing:
        return addition
    return f"{existing} + {addition}"


def make_breakdown(value: Optional[float], unit: Optional[str], recipe_name: Optional[str]):
    # "?" stands in for a fuzzy amount — that recipe asked for a splash, not a number
    return f"{format_amount(value, unit) or '?'} ({recipe_name})"


def consolidate_ingredients(recipes_with_names: list[dict]) -> list[ShoppingListItem]:

    # key: normalized ingredient name, value: ShoppingListItem being built
    groups: dict[str, ShoppingListItem] = {}

    for recipe in recipes_with_names:
        ingredient = recipe["ingredient"]
        recipe_name = recipe["recipe_name"]
        ing_name = ingredient.name.strip().lower()
        ing_breakdown = make_breakdown(ingredient.quantity_value, ingredient.unit, recipe_name)

        if ing_name not in groups:
            # first time seeing this ingredient
            groups[ing_name] = ShoppingListItem(
                name=ingredient.name,
                quantity_text=ingredient_amount(ingredient),
                quantity_value=ingredient.quantity_value,
                unit=ingredient.unit,
                quantity_type=ingredient.quantity_type,
                breakdown=ing_breakdown,
            )
        else:
            # ingredient already seen - try to consolidate
            existing = groups[ing_name]
            existing.breakdown += f" + {ing_breakdown}"

            if ingredient.quantity_value is not None and existing.quantity_value is not None:
                # both have numeric values - try to sum
                if ingredient.unit is None and existing.unit is None:
                    # both are countable - sum directly
                    existing.quantity_value = existing.quantity_value + ingredient.quantity_value
                    existing.quantity_text = format_amount(existing.quantity_value, existing.unit)
                else:
                    converted = convert(
                        ingredient.quantity_value, ingredient.unit, existing.unit, ing_name
                    )
                    if converted is not None:
                        # conversion succeeded - sum the values
                        existing.quantity_value = round(existing.quantity_value + converted, 2)
                        existing.quantity_text = format_amount(
                            existing.quantity_value, existing.unit
                        )
                    else:
                        # conversion failed - show both amounts, and drop the numeric
                        # fields so nothing downstream reports one side as the total
                        existing.quantity_text = join_amounts(
                            existing.quantity_text, ingredient_amount(ingredient)
                        )
                        existing.quantity_value = None
                        existing.unit = None
            else:
                # One side is fuzzy ("a good splash"), so no number can describe the
                # sum any more — show the amounts side by side and clear the numeric
                # fields even if the running total had one.
                existing.quantity_text = join_amounts(
                    existing.quantity_text, ingredient_amount(ingredient)
                )
                existing.quantity_value = None
                existing.unit = None

            # if quantity types differ, mark as imprecise
            if existing.quantity_type != ingredient.quantity_type:
                existing.quantity_type = "imprecise"

    return list(groups.values())
