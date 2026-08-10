// The colour behind a recipe with no cover photo.
//
// This file used to also hold `coverLine` and `splitAmount`, which pulled a quotable
// line out of a recipe — a folk amount or a step remark — for the cover to set as large
// type. Both are deleted, not refactored away: a real user looked at the result and
// asked "why are there ingredients on the cover photo?", which is the correct reading of
// display type inside a photo-shaped, photo-sized frame. CoverImage.jsx carries the full
// history of the three treatments and why each replaced the last.
//
// Deleted rather than kept for later, deliberately. The same extraction idea survives
// where it actually works — `quotableLines` / `lineOfTheDay` in lib/kitchenFacts.js,
// feeding a card that is visibly A QUOTE (curly stamp, attribution beneath, its own
// section heading) instead of a frame the eye reads as a photograph. A second unused
// copy of the logic would be an invitation to put it back in the wrong place, and this
// repo already knows what unreachable code costs: see the shopping-list removal note in
// FUTURE.md, where a crash and three wrong-total bugs lived undetected in a feature no
// screen ever called.

// Four field colours, keyed off the recipe id so a given dish always looks the same and
// two neighbours in a grid rarely match. All four are AA-safe under ink — peach 9.35,
// sage 6.42, saffron 4.93, line 8.58 — which still matters, because the mark sits on top.
const FIELDS = ['bg-peach', 'bg-sage', 'bg-saffron', 'bg-line']

export function coverField(recipe) {
  const seed = Number(recipe?.id) || 0
  return FIELDS[Math.abs(seed) % FIELDS.length]
}
