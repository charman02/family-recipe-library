// Single source of truth for every glyph in the app. We inline Lucide-style
// SVG paths (24-grid, ~1.7 stroke) rather than pull in a package: it keeps the
// "custom Tailwind only" constraint, adds zero dependencies, and — importantly —
// reproduces the exact glyphs from the approved mockup, several of which are
// hand-tuned (the compass needle is filled, the bowl and book are custom) and
// would look different if drawn from stock Lucide.
//
// Usage: <Icon name="mail" className="w-[17px] h-[17px] text-terra" />
// Size and color ride on className. Stroke width defaults to 1.7 but a few
// glyphs override it to match the mockup.

const paths = {
  // navigation set
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none" />
    </>
  ),
  // An OPEN book — two facing pages rising from a centre spine.
  //
  // It used to be a closed volume with a bookmark notch, which at 20px was
  // unreadable: it looked like a tag, a shield, or a bookmark on its own. Open, the
  // silhouette is unmistakable, and it's also the right image for a recipe's story —
  // a book being read, not one shelved.
  book: (
    <>
      {/* the two page blocks, curving down to the spine */}
      <path d="M12 7.2C10.3 5.9 8.2 5.3 5 5.2v11.6c3.2.1 5.3.7 7 2z" />
      <path d="M12 7.2c1.7-1.3 3.8-1.9 7-2v11.6c-3.2.1-5.3.7-7 2z" />
      {/* the spine */}
      <path d="M12 7.2v11.6" />
    </>
  ),
  // A list — the shape of a recipe's method.
  //
  // All three markers are the SAME filled dot and all three rules are the SAME
  // length. The first pass filled only the first dot (trying to say "ordered") and
  // shortened the last rule (a ragged-edge flourish) — at 20px both read as a
  // rendering fault rather than as intent: two dots looked hollow next to one solid,
  // and the short rule looked like a clipped line. Repetition IS the list.
  list: (
    <>
      <circle cx="5.5" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 7h9M10 12h9M10 17h9" />
    </>
  ),

  // A note left on the page — a small sheet with a folded corner and two lines of
  // writing. Distinct from `book` (a bound volume) at 20px, which matters because
  // both appear in the same list.
  note: (
    <>
      <path d="M5.5 4.5h9l4 4v11h-13z" />
      <path d="M14.5 4.5v4h4" />
      <path d="M8.5 12.5h6M8.5 15.5h4" />
    </>
  ),

  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Cooking pot — an unambiguous "kitchen" symbol: lidded pot with two handles
  // and rising steam. Reads clearly at nav size.
  pot: (
    <>
      {/* steam */}
      <path d="M9 3.5c0 1-1 1.5-1 2.5M13 3c0 1.2-1.2 1.7-1.2 2.9" strokeWidth="1.5" />
      {/* lid with knob */}
      <path d="M4.5 9.5h15" />
      <path d="M12 7.4v2" />
      {/* pot body + side handles */}
      <path d="M6 9.5h12l-.8 8.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8z" />
      <path d="M6 11.5H4.4M18 11.5h1.6" />
    </>
  ),

  // actions / affordances
  back: <path d="M15 5l-7 7 7 7" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,

  // form / field icons
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  camera: (
    <>
      <path d="M6.8 6.2A2.3 2.3 0 0 1 5.2 7.2c-1 .1-1.9.3-2 1.4V18a2 2 0 0 0 2 2h13.5a2 2 0 0 0 2-2V9.6c0-1-.8-1.9-1.8-2a2.3 2.3 0 0 1-1.6-1L16 5.3a2.2 2.2 0 0 0-1.7-1 48 48 0 0 0-5.2 0 2.2 2.2 0 0 0-1.7 1z" />
      <circle cx="12" cy="12.8" r="3.5" />
    </>
  ),

  // Dictation. The mic is the affordance for SPEAKING TEXT INTO A FIELD — the
  // browser transcribes and the utterance is discarded. Nothing in this app
  // captures, stores or plays sound, so no label beside this glyph may suggest
  // it does (POSITIONING.md). The square is the stop control while dictating:
  // a shape change, so the active state never rests on colour alone.
  mic: (
    <>
      <path d="M12 2.5a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0v-6a3 3 0 0 0-3-3z" />
      <path d="M18.5 11v1a6.5 6.5 0 0 1-13 0v-1" />
      <path d="M12 18.5V21" />
    </>
  ),
  stop: <rect x="7.5" y="7.5" width="9" height="9" rx="2" />,

  // recipe meta row
  serves: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  bowl: (
    <path d="M4 11h16M6 11a6 6 0 0 1 12 0M9 4v2M15 4v2M4 15h16v1a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}

// A few glyphs read better at a slightly different weight — matches the mockup.
const strokeOverrides = { back: 1.9, edit: 1.8, plus: 2 }

export default function Icon({ name, className = '', strokeWidth }) {
  const inner = paths[name]
  if (!inner) return null
  const sw = strokeWidth ?? strokeOverrides[name] ?? 1.7
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {inner}
    </svg>
  )
}
