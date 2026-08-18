// Cuisine matching for the Browse filter.
//
// Cuisine is free text a user typed on their own recipe, so it drifts: "Japanese",
// "japanese ", "Japanese?", "Japanese food". The Browse filter used strict
// lowercased equality, so any of those failed to match the "Japanese" filter chip —
// a recipe just vanished from its cuisine section. This normalizes both sides so a
// near-miss still matches.
//
// Deliberately NOT fuzzy (no edit-distance): a typo'd "Japanse" should not silently
// land under "Japanese". This only strips the noise that isn't part of the word —
// case, surrounding whitespace, trailing punctuation, and a trailing " food"/"cuisine".

export function normalizeCuisine(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:]+$/, '') // trailing punctuation: "Japanese?" -> "japanese"
    .replace(/\s+(food|cuisine|dish|style)$/, '') // "Japanese food" -> "japanese"
    .trim()
}

// True when a recipe's (messy) cuisine matches a (clean) filter value. An empty
// filter matches everything; an empty recipe cuisine matches only the empty filter.
export function matchesCuisine(recipeCuisine, filterValue) {
  const filter = normalizeCuisine(filterValue)
  if (!filter) return true
  return normalizeCuisine(recipeCuisine) === filter
}
