"""Unit conversion.

`convert(value, from_unit, to_unit)` answers "this much of from_unit is how much
of to_unit?", so the direction is the whole game: converting INTO a larger unit
must produce a SMALLER number. Getting that backwards silently reports 8 tbsp of
vinegar as 128 cups on a shopping list, which is why every family gets an
explicit both-directions test here.
"""

from app.services.units import convert


# Volume, within the family


def test_small_to_large_volume_shrinks_the_number():
    assert convert(8, "tbsp", "cup") == 0.5
    assert convert(3, "tsp", "tbsp") == 1.0
    assert convert(500, "ml", "l") == 0.5


def test_large_to_small_volume_grows_the_number():
    assert convert(1, "cup", "tbsp") == 16.0
    assert convert(1, "l", "ml") == 1000.0
    assert convert(1, "cup", "ml") == 240.0


def test_same_volume_unit_is_the_identity():
    assert convert(2.5, "cup", "cup") == 2.5


# Weight, within the family


def test_small_to_large_weight_shrinks_the_number():
    assert convert(1000, "g", "kg") == 1.0
    assert convert(453.59, "g", "lb") == 1.0
    # a pound is ~16 oz, so 16 oz is a bit under 1 lb with this table's rounding
    sixteen_oz = convert(16, "oz", "lb")
    assert sixteen_oz is not None and 0.99 < sixteen_oz < 1.01


def test_large_to_small_weight_grows_the_number():
    assert convert(1, "kg", "g") == 1000.0
    one_lb_in_oz = convert(1, "lb", "oz")
    assert one_lb_in_oz is not None and round(one_lb_in_oz, 2) == 16.0


# Cross-family: needs a density, and only for known ingredients


def test_volume_to_weight_uses_the_density_table():
    # 1 cup water = 240 ml, density 1.0 g/ml -> 240 g
    assert convert(1, "cup", "g", "water") == 240.0


def test_weight_to_volume_uses_the_density_table():
    assert convert(240, "g", "cup", "water") == 1.0


def test_cross_family_without_a_known_density_refuses_to_guess():
    # Vinegar isn't in the density table, so cup <-> g is unknowable. Returning
    # None is what lets the shopping list show both amounts instead of inventing
    # a total.
    assert convert(2, "cup", "g", "vinegar") is None
    assert convert(2, "cup", "g") is None
    assert convert(3, "g", "cup", "vinegar") is None


# Unknown units


def test_unknown_or_missing_units_return_none():
    assert convert(1, "handful", "cup") is None
    assert convert(1, "cup", "pinch") is None
    assert convert(1, None, "cup") is None
    assert convert(1, "cup", None) is None


def test_units_are_matched_case_and_whitespace_insensitively():
    assert convert(1, " CUP ", "Tbsp") == 16.0


# The round trip is the strongest statement that the direction is right


def test_converting_there_and_back_returns_the_original():
    there = convert(8, "tbsp", "cup")
    assert there is not None
    back = convert(there, "cup", "tbsp")
    assert back is not None and round(back, 6) == 8.0

    there_w = convert(500, "g", "kg")
    assert there_w is not None
    back_w = convert(there_w, "kg", "g")
    assert back_w is not None and round(back_w, 6) == 500.0
