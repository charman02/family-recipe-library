import { useEffect, useRef, useState } from 'react'
import { REAL_UNITS, FOLK_CHIP_UNITS, appendUnit } from '../lib/amountChips'

// The unit strip under the "How much" field. Appears only once a bare number has
// been typed and there's no unit yet (see shouldOfferUnits), so it's offering the
// exact word that's missing and nothing else.
//
// Real units and folk units share one row, deliberately. Putting the folk ones
// behind a "more" tap would re-state the ranking this product exists to refuse.
// They're differentiated by tint and, because tint alone can't carry meaning, by
// a labelled group each that screen readers announce.
//
// Tab order: ONE stop for the whole strip, with arrow keys moving between chips
// (roving tabindex). Sixteen tab stops sitting between the amount field and the
// next ingredient would make the keyboard path measurably worse for the sake of
// a shortcut — the strip has to be reachable, not unavoidable.
function Chip({ unit, tone, tabbable, onPick, register }) {
  return (
    <button
      type="button"
      ref={register}
      tabIndex={tabbable ? 0 : -1}
      // Prevented mousedown keeps focus in the amount field, so tapping a unit
      // on a phone doesn't dismiss the keyboard mid-entry.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(unit)}
      className={`chip sticker-press flex-shrink-0 whitespace-nowrap text-[12px] px-3 py-[5px] ${
        tone === 'folk' ? 'chip--saffron' : ''
      }`}
    >
      {unit.label}
    </button>
  )
}

export default function AmountUnitChips({ value, onPick, onDone, index }) {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  // Flat for keyboard traversal, grouped for rendering — the roving tabindex
  // needs one linear order across both groups.
  // "Rough amounts", not "their own words" / "in their words": POSITIONING.md
  // bans copy implying verbatim speech or a recording, and this is a set of unit
  // words the app ships, not anything the source person said.
  const groups = [
    { label: 'Measurements', tone: 'real', units: REAL_UNITS },
    { label: 'Rough amounts', tone: 'folk', units: FOLK_CHIP_UNITS },
  ]
  const units = groups.flatMap((g) =>
    g.units.map((u) => ({ unit: u, tone: g.tone })),
  )

  // Only move focus once the user is actually navigating inside the strip.
  // Focusing on mount would steal the caret out of the amount field the instant
  // a digit was typed, which is the opposite of what the strip is for.
  const navigating = useRef(false)
  useEffect(() => {
    if (navigating.current) refs.current[active]?.focus()
  }, [active])

  function pick(unit) {
    onPick(appendUnit(value, unit))
    // The strip unmounts on the next render (there's a unit now), so a chip that
    // was focused would drop focus to <body>. Hand it back to the field the user
    // is editing — a no-op for a tap, the difference between working and not for
    // a keyboard.
    onDone?.()
  }

  function handleKeyDown(e) {
    const last = units.length - 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      navigating.current = true
      setActive((prev) => {
        const next = prev + (e.key === 'ArrowRight' ? 1 : -1)
        // Wraps, so the folk units are one keystroke from the start of the row
        // rather than eight.
        return next < 0 ? last : next > last ? 0 : next
      })
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onDone?.()
    }
  }

  return (
    <div
      role="toolbar"
      aria-label={`Amount units for ingredient ${index + 1}`}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-1.5 pb-1"
    >
      {/* Two labelled groups, so the saffron/cream tint isn't the only thing
          carrying which is which. The folk group's name is the product's own
          language for it. */}
      {groups.map((group, gi) => (
        <div
          key={group.label}
          role="group"
          aria-label={group.label}
          className="flex gap-1.5"
        >
          {group.units.map((unit, ui) => {
            const i = gi === 0 ? ui : groups[0].units.length + ui
            return (
              <Chip
                key={unit.label}
                unit={unit}
                tone={group.tone}
                tabbable={i === active}
                onPick={pick}
                register={(el) => {
                  refs.current[i] = el
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
