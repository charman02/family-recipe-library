"""Shopping-list consolidation.

The consolidated `quantity_text` is the line a person actually reads at the store,
so the invariant under test throughout is: the total must never *lie*. Either the
amounts really summed (and `quantity_value`/`unit` describe that sum), or they
couldn't (and the numeric fields are cleared so nothing claims a false total).
Fuzzy amounts — "a good splash" — are the common case for this app, not the edge.
"""

import pytest

from app.models.ingredient import Ingredient
from app.services.shopping_list import consolidate_ingredients


def _ing(name, text=None, value=None, unit=None, qtype="precise"):
    # Unsaved ORM instance: consolidation only reads attributes, so no DB needed.
    return Ingredient(
        name=name,
        quantity_text=text,
        quantity_value=value,
        unit=unit,
        quantity_type=qtype,
        position=1,
    )


def _consolidate(*pairs):
    return consolidate_ingredients(
        [{"recipe_name": recipe_name, "ingredient": ing} for recipe_name, ing in pairs]
    )


# --- numeric consolidation ---


def test_same_unit_amounts_are_summed():
    items = _consolidate(
        ("Adobo", _ing("vinegar", "2 cups", 2, "cup")),
        ("Sinigang", _ing("vinegar", "1 cup", 1, "cup")),
    )
    assert len(items) == 1
    assert items[0].quantity_value == 3
    assert items[0].unit == "cup"
    assert items[0].quantity_text == "3 cup"


def test_countable_amounts_are_summed_as_whole_numbers():
    """Unitless counts must not read as "5.0 eggs" on a shopping list."""
    items = _consolidate(
        ("Adobo", _ing("egg", "2", 2)),
        ("Champorado", _ing("egg", "3", 3)),
    )
    assert items[0].quantity_value == 5
    assert items[0].quantity_text == "5"


def test_convertible_units_are_summed_through_the_density_table():
    """cup -> g needs a density lookup; water is in DENSITY_TABLE, so 240 g of it
    really is one more cup and the two lines collapse into a single real total."""
    items = _consolidate(
        ("Congee", _ing("water", "1 cup", 1, "cup")),
        ("Broth", _ing("water", "240 g", 240, "g")),
    )
    assert len(items) == 1
    assert items[0].quantity_value == 2
    assert items[0].unit == "cup"


def test_units_in_the_same_family_are_summed():
    items = _consolidate(
        ("Adobo", _ing("vinegar", "1 cup", 1, "cup")),
        ("Sinigang", _ing("vinegar", "8 tbsp", 8, "tbsp")),
    )
    assert items[0].quantity_value == 1.5


def test_unconvertible_units_do_not_produce_a_wrong_number():
    """Vinegar has no density, so cup <-> g is unknowable. The two amounts must be
    shown side by side with the numeric fields dropped — a leftover
    quantity_value would advertise "2 cup" as the total for 2 cup + 3 g."""
    items = _consolidate(
        ("Adobo", _ing("vinegar", "2 cups", 2, "cup")),
        ("Pickles", _ing("vinegar", "3 g", 3, "g")),
    )
    assert len(items) == 1
    assert items[0].quantity_value is None
    assert items[0].unit is None
    assert items[0].quantity_text == "2 cups + 3 g"


def test_unconvertible_units_fall_back_to_the_numbers_when_no_text_was_typed():
    """quantity_text is optional at the API boundary. Without a fallback the second
    amount rendered as the literal string "None"."""
    items = _consolidate(
        ("Adobo", _ing("vinegar", None, 2, "cup")),
        ("Pickles", _ing("vinegar", None, 3, "g")),
    )
    assert "None" not in items[0].quantity_text
    assert items[0].quantity_text == "2 cup + 3 g"


# --- the fuzzy path: no numeric value on either side ---


def test_two_fuzzy_amounts_consolidate():
    """The product's most common case, and the one that used to raise
    AttributeError: Ingredient has no `quantity` attribute at all."""
    items = _consolidate(
        ("Adobo", _ing("cane vinegar", "a good splash", qtype="imprecise")),
        ("Sinigang", _ing("cane vinegar", "a glug", qtype="imprecise")),
    )
    assert len(items) == 1
    assert items[0].quantity_text == "a good splash + a glug"
    assert items[0].quantity_value is None
    assert items[0].quantity_type == "imprecise"


def test_repeated_fuzzy_amounts_are_kept_twice():
    """Two recipes each wanting a splash need two splashes bought. Collapsing
    identical text would quietly halve the amount."""
    items = _consolidate(
        ("Adobo", _ing("vinegar", "a splash", qtype="imprecise")),
        ("Sinigang", _ing("vinegar", "a splash", qtype="imprecise")),
    )
    assert items[0].quantity_text == "a splash + a splash"


def test_fuzzy_amount_with_no_text_at_all_is_skipped_cleanly():
    """An "unmeasured" ingredient ("salt") carries no amount to append; the line
    must not end up with a dangling separator."""
    items = _consolidate(
        ("Adobo", _ing("salt", None, qtype="unmeasured")),
        ("Sinigang", _ing("salt", None, qtype="unmeasured")),
    )
    assert items[0].quantity_text == ""


def test_a_fuzzy_amount_does_not_inherit_a_dangling_separator():
    """First occurrence had no text, second did — the joined line must start with
    the real amount, not with " + "."""
    items = _consolidate(
        ("Adobo", _ing("soy sauce", None, qtype="unmeasured")),
        ("Sinigang", _ing("soy sauce", "3 soup spoons", qtype="imprecise")),
    )
    assert items[0].quantity_text == "3 soup spoons"


# --- mixed: one numeric, one fuzzy ---


def test_a_fuzzy_amount_clears_the_running_number():
    """Once "a good splash" joins "2 cup", no number describes the total any more.
    Keeping quantity_value=2 would let the UI render a total that is simply wrong."""
    items = _consolidate(
        ("Adobo", _ing("vinegar", "2 cups", 2, "cup")),
        ("Sinigang", _ing("vinegar", "a good splash", qtype="imprecise")),
    )
    assert len(items) == 1
    assert items[0].quantity_text == "2 cups + a good splash"
    assert items[0].quantity_value is None
    assert items[0].unit is None
    # a precise + an imprecise amount can only be described imprecisely
    assert items[0].quantity_type == "imprecise"


def test_a_number_joining_a_fuzzy_amount_is_not_dropped():
    """Reverse order of the case above. The numeric ingredient carries no typed
    text, so it has to be rendered from its value — otherwise the 2 cups vanish."""
    items = _consolidate(
        ("Sinigang", _ing("vinegar", "a good splash", qtype="imprecise")),
        ("Adobo", _ing("vinegar", None, 2, "cup")),
    )
    assert items[0].quantity_text == "a good splash + 2 cup"
    assert items[0].quantity_value is None


def test_a_lone_ingredient_shows_its_amount_even_with_no_typed_text():
    items = _consolidate(("Adobo", _ing("vinegar", None, 2, "cup")))
    assert items[0].quantity_text == "2 cup"


# --- grouping and provenance ---


def test_names_are_grouped_case_insensitively_and_keep_the_first_spelling():
    items = _consolidate(
        ("Adobo", _ing("Cane Vinegar", "1 cup", 1, "cup")),
        ("Sinigang", _ing("  cane vinegar ", "1 cup", 1, "cup")),
    )
    assert len(items) == 1
    assert items[0].name == "Cane Vinegar"
    assert items[0].quantity_value == 2


def test_breakdown_attributes_every_source_recipe():
    """The breakdown is how a cook decides what to drop when buying less — it must
    survive even when the amounts can't be summed."""
    items = _consolidate(
        ("Adobo", _ing("vinegar", "2 cups", 2, "cup")),
        ("Sinigang", _ing("vinegar", "a good splash", qtype="imprecise")),
    )
    assert items[0].breakdown == "2 cup (Adobo) + ? (Sinigang)"


def test_distinct_ingredients_stay_separate():
    items = _consolidate(
        ("Adobo", _ing("vinegar", "1 cup", 1, "cup")),
        ("Adobo", _ing("soy sauce", "1 cup", 1, "cup")),
    )
    assert {i.name for i in items} == {"vinegar", "soy sauce"}


# --- through the endpoint ---


def _recipe(client, headers, name, ingredients):
    r = client.post(
        "/recipes",
        json={
            "name": name,
            "ingredients": [{**ing, "position": i + 1} for i, ing in enumerate(ingredients)],
            "steps": [{"content": "Cook it.", "position": 1}],
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_endpoint_consolidates_fuzzy_ingredients_across_recipes(client, make_user):
    """End-to-end cover for the crash: two recipes, both calling for a splash of
    vinegar, used to 500 on POST /shopping-list."""
    _user, headers = make_user()
    a = _recipe(
        client,
        headers,
        "Adobo",
        [{"name": "cane vinegar", "quantity_text": "a good splash", "quantity_type": "imprecise"}],
    )
    b = _recipe(
        client,
        headers,
        "Sinigang",
        [{"name": "cane vinegar", "quantity_text": "a glug", "quantity_type": "imprecise"}],
    )

    r = client.post("/shopping-list", json={"recipe_ids": [a["id"], b["id"]]}, headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["quantity_text"] == "a good splash + a glug"
    assert "Adobo" in items[0]["breakdown"] and "Sinigang" in items[0]["breakdown"]


def test_endpoint_consolidates_sectioned_ingredients(client, make_user):
    """Sectioned ingredients ("For the marinade") reach consolidation by a separate
    path in the router than loose ones; both must feed the same group."""
    _user, headers = make_user()
    a = client.post(
        "/recipes",
        json={
            "name": "Adobo",
            "ingredient_sections": [
                {
                    "name": "For the marinade",
                    "position": 1,
                    "ingredients": [
                        {
                            "name": "vinegar",
                            "quantity_text": "1 cup",
                            "quantity_value": 1,
                            "unit": "cup",
                            "quantity_type": "precise",
                            "position": 1,
                        }
                    ],
                }
            ],
            "steps": [{"content": "Marinate.", "position": 1}],
        },
        headers=headers,
    ).json()
    b = _recipe(
        client,
        headers,
        "Sinigang",
        [
            {
                "name": "vinegar",
                "quantity_text": "1 cup",
                "quantity_value": 1,
                "unit": "cup",
                "quantity_type": "precise",
            }
        ],
    )

    r = client.post("/shopping-list", json={"recipe_ids": [a["id"], b["id"]]}, headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["quantity_value"] == 2


def test_endpoint_requires_auth(client, make_user):
    _user, headers = make_user()
    a = _recipe(client, headers, "Adobo", [{"name": "vinegar", "quantity_type": "unmeasured"}])
    assert client.post("/shopping-list", json={"recipe_ids": [a["id"]]}).status_code == 401


def test_endpoint_will_not_shop_someone_elses_recipe(client, make_user):
    _owner, oheaders = make_user()
    a = _recipe(client, oheaders, "Adobo", [{"name": "vinegar", "quantity_type": "unmeasured"}])
    _other, xheaders = make_user()
    r = client.post("/shopping-list", json={"recipe_ids": [a["id"]]}, headers=xheaders)
    assert r.status_code == 404
