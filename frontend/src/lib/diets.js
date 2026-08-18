// The shared diet vocabulary — the recipe form's Diet dropdown AND the Browse Diet
// filter draw from this one list so a recipe's diet always matches a filter option.
// Single-value (the recipe's `diet` column is one string; the Browse filter matches
// one value), so a dish that is both vegetarian and gluten-free picks the primary
// one for now. A multi-select diet is a possible later change, but it needs a column
// shape change, so it's deliberately out of scope here.
export const DIETS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Halal',
  'Kosher',
]
