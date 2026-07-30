// Parses a single free-text quantity input (e.g. "1 1/2 cups", "a dash",
// "~3 tbsp") into the four fields the backend expects:
//   quantity_text  - the raw input, kept verbatim for display
//   quantity_value - numeric value for the scaling engine (fractions supported)
//   unit           - the remainder after the number
//   quantity_type  - inferred: precise | imprecise | unmeasured
//
// This lets users type quantities the natural way while still feeding the
// scaling engine a parsed numeric value. Keep in sync with the three-type
// model in app/services/scaling.py.

const UNICODE_FRACTIONS = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

// Hedges: the cook signalling they didn't measure ("~3 tbsp", "about 2 cups").
const IMPRECISE_MARKERS =
  /(~|\babout\b|\bapprox\b|\bapproximately\b|\broughly\b|\baround\b)/i

// Folk / body / vessel units — the way people who never measure actually talk.
// These matter more than the hedges: without them "3 soup spoons" (the README's
// flagship example) parsed as PRECISE and the scaling engine multiplied it into
// "7.5 soup spoons", which is exactly the normalization this app exists to
// refuse. A folk unit makes an amount imprecise no matter how clean its number
// looks, because the VESSEL is unknowable even when the count is exact.
//
// Deliberately NOT here: tsp/tbsp/cup/g/kg/oz/lb/ml/l — real units that scale.
// Word-bounded and matched against the unit remainder, so "tablespoon" (precise)
// can't be caught by "spoon".
//
// KEEP IN SYNC with `app/services/folk_units.py`, which uses the same vocabulary
// to decide how an amount SCALES. A unit known here but not there would be
// tagged "their way" at entry and then silently multiplied when scaled — the two
// halves have to agree or the promise breaks in the middle.
const FOLK_UNITS = [
  // spoons and vessels that vary by household
  'soup spoon',
  'soup spoons',
  'spoonful',
  'spoonfuls',
  'rice cooker cup',
  'rice cooker cups',
  'wineglass',
  'wineglasses',
  'teacup',
  'teacups',
  'bowl',
  'bowls',
  'can',
  'cans',
  'jar',
  'jars',
  'packet',
  'packets',
  // the body as a measure
  'pinch',
  'pinches',
  'handful',
  'handfuls',
  'fistful',
  'fistfuls',
  'finger',
  'fingers',
  // pours and gestures
  'glug',
  'glugs',
  'splash',
  'splashes',
  'dash',
  'dashes',
  'drizzle',
  'drizzles',
  'drop',
  'drops',
  'sprinkle',
  'sprinkles',
  'squeeze',
  'squeezes',
  'knob',
  'knobs',
  'lump',
  'lumps',
  'smidgen',
  'smidgens',
  'smidge',
  'sliver',
  'slivers',
  // hedged real units — the qualifier is the imprecision
  'heaping',
  'heaped',
  'scant',
  'generous',
  'rounded',
  'level',
]

// Longest-first so "soup spoon" wins over "spoonful"-style shorter overlaps, and
// word-bounded so no folk word can match inside a longer real word.
const FOLK_UNIT_PATTERN = new RegExp(
  `\\b(${[...FOLK_UNITS].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'i',
)

// Pulls a leading number off a string, supporting "1 1/2" (mixed),
// "1/2" (fraction), and "1.5"/"2" (decimal/whole). Returns [value, rest].
function parseLeadingNumber(str) {
  let m = str.match(/^(\d+)\s+(\d+)\/(\d+)\b\s*(.*)$/)
  if (m) return [parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]), m[4]]

  m = str.match(/^(\d+)\/(\d+)\b\s*(.*)$/)
  if (m) return [parseInt(m[1]) / parseInt(m[2]), m[3]]

  m = str.match(/^(\d*\.?\d+)\s*(.*)$/)
  if (m) return [parseFloat(m[1]), m[2]]

  return [null, str]
}

export function parseQuantity(raw) {
  const text = (raw || '').trim()
  if (!text) {
    return {
      quantity_text: null,
      quantity_value: null,
      unit: null,
      quantity_type: 'unmeasured',
    }
  }

  // Normalize unicode fractions: "1½" -> "1 1/2", standalone "½" -> "1/2".
  let normalized = text
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    normalized = normalized.replace(new RegExp(glyph, 'g'), (match, offset) => {
      const prev = normalized[offset - 1]
      return prev && /\d/.test(prev) ? ' ' + ascii : ascii
    })
  }

  const hedged = IMPRECISE_MARKERS.test(normalized)

  // Strip leading imprecise markers so the number parses cleanly.
  const working = normalized
    .replace(/^~\s*/, '')
    .replace(/^(about|approx|approximately|roughly|around)\s+/i, '')

  const [value, rest] = parseLeadingNumber(working)
  const unit = (rest || '').trim() || null

  // A folk unit is checked against the UNIT remainder, not the whole string, so
  // an ingredient name can't drag the type sideways.
  const folk = unit !== null && FOLK_UNIT_PATTERN.test(unit)

  let quantity_type
  if (value === null) quantity_type = 'unmeasured'
  else if (hedged || folk) quantity_type = 'imprecise'
  else quantity_type = 'precise'

  return {
    quantity_text: text,
    quantity_value: value,
    unit: quantity_type === 'unmeasured' ? null : unit,
    quantity_type,
  }
}
