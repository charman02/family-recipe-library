// The shared cuisine vocabulary — the static half of cuisine autosuggest on the
// recipe form AND the Browse filter's section list. One source so the two can't
// drift: a recipe tagged with a suggested cuisine is guaranteed to have a matching
// Browse section. (Free text still wins — a cuisine not listed here types fine and
// is matched by lib/cuisineMatch.js.)
//
// Leans the same way the app does (Asian home cooking first) since that's the
// cooking issei was built to preserve; broadly-represented others ride along.
export const CUISINES = [
  'Japanese',
  'Korean',
  'Chinese',
  'Filipino',
  'Vietnamese',
  'Thai',
  'Indian',
  'Middle Eastern',
  'Mexican',
  'Italian',
  'West African',
  'Caribbean',
]
