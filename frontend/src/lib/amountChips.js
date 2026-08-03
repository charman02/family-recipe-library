// Tappable units for the "How much" field.
//
// The point is not only fewer keystrokes. Folk units sit in the SAME strip as
// tsp/cup/g, at the same size, with no apology — which is how the form teaches
// that "3 soup spoons" is a legitimate answer rather than a failure to measure.
// A cook who has been told her whole life that her amounts are imprecise will not
// discover that from placeholder text; she'll discover it from seeing "pinch"
// offered as a first-class option.
//
// The folk entries here are a SUBSET of the vocabulary in
// `frontend/src/utils/quantity.js` / `app/services/folk_units.py`, and that's
// intentional: those lists have to recognise everything anyone might type, while
// this one has to fit two thumb-sized rows on a 430px screen. Every entry below
// is one both lists already classify, so a tapped chip and a typed word behave
// identically — a chip can never produce an amount the parser treats differently
// from the same words typed by hand.
//
// Chosen for: things a NUMBER naturally precedes (you say "2 pinches", not "2
// smidgens"), and the ones that came up in testing as how people actually talk.
// Left off on purpose — smidge/sliver/lump/fistful/drizzle/sprinkle/squeeze/
// teacup/wineglass/jar/packet/bowl, the non-linear body measures (finger,
// knuckle, thumb — they need "of water" after them to make sense, so a bare chip
// would write a fragment), and the hedge qualifiers (heaping, scant), which
// prefix another unit rather than replace it and would need two taps to be useful.

// plural: null when the word doesn't inflect (2 tbsp, 2 g).
export const REAL_UNITS = [
  { label: 'tsp', plural: null },
  { label: 'tbsp', plural: null },
  { label: 'cup', plural: 'cups' },
  { label: 'g', plural: null },
  { label: 'kg', plural: null },
  { label: 'ml', plural: null },
  { label: 'oz', plural: null },
  { label: 'lb', plural: null },
]

export const FOLK_CHIP_UNITS = [
  { label: 'soup spoon', plural: 'soup spoons' },
  { label: 'pinch', plural: 'pinches' },
  { label: 'handful', plural: 'handfuls' },
  { label: 'dash', plural: 'dashes' },
  { label: 'splash', plural: 'splashes' },
  { label: 'glug', plural: 'glugs' },
  { label: 'knob', plural: 'knobs' },
  { label: 'can', plural: 'cans' },
]

// Mirrors parseLeadingNumber in utils/quantity.js: mixed ("1 1/2"), fraction
// ("1/2"), decimal or whole. Kept local because this module only needs to know
// whether a bare number is sitting there, not to classify the amount.
const LEADING_NUMBER = /^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*/

/**
 * Should the unit strip be offered for what's currently in the amount field?
 *
 * Only once there's a number and NOTHING after it. Two reasons the "nothing
 * after it" half matters: a strip appearing under text that's already finished
 * ("a good splash") is noise, and it's the guarantee that a tap can only ever
 * ADD to what the user wrote — see appendUnit.
 */
export function shouldOfferUnits(value) {
  const text = (value || '').trim()
  if (!text) return false
  return text.replace(LEADING_NUMBER, '') === '' && LEADING_NUMBER.test(text)
}

function leadingCount(text) {
  let m = text.match(/^(\d+)\s+(\d+)\/(\d+)/)
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3])
  m = text.match(/^(\d+)\/(\d+)/)
  if (m) return parseInt(m[1]) / parseInt(m[2])
  m = text.match(/^(\d*\.?\d+)/)
  if (m) return parseFloat(m[1])
  return null
}

/**
 * Add a chip's unit to the amount, inflected for the number in front of it.
 *
 * Returns the value UNCHANGED when there's already a unit there. A chip must
 * never clobber typed words: the user's own phrasing is the thing this app
 * exists to keep, and silently rewriting it would be the worst possible bug on
 * this surface. The button is hidden in that state anyway; this is the backstop.
 */
export function appendUnit(value, unit) {
  const text = (value || '').trim()
  if (!shouldOfferUnits(text)) return value
  const count = leadingCount(text)
  // "1/2 cup", not "1/2 cups" — a fraction of one takes the singular, the way a
  // person writes it. Only a count of exactly 1 or less does.
  const word = unit.plural && count != null && count > 1 ? unit.plural : unit.label
  return `${text} ${word}`
}
