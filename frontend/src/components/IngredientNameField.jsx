import { useId, useMemo, useState } from 'react'
import { matchIngredients } from '../lib/commonIngredients'
import DictateButton from './DictateButton'

// The ingredient-name input plus its autosuggest strip.
//
// WHY A STRIP AND NOT A DROPDOWN. Every convention here comes from the same
// constraint: this is used one-handed, on a phone, with the keyboard occupying
// the bottom half of the screen. An absolutely-positioned menu in that space
// either lands under the keyboard or lands on top of the "How much" field the
// user is heading for next — so the suggestions live IN the layout flow, a single
// horizontally-scrolling row directly beneath the input they belong to. It can't
// cover anything because it doesn't overlap anything, and the one row it adds
// disappears the moment the name is complete.
//
// The options are tapped, not focused: `onMouseDown` is prevented so the input
// never blurs, which is what keeps the keyboard up through the tap. Keyboard
// users drive the same list from the input via arrow keys (the standard
// combobox + aria-activedescendant pattern), so nothing here needs a tab stop.
//
// Free text always wins. The strip is advisory: it never fills the field on its
// own, Escape closes it, and typing a name no list has ever heard of works
// exactly as it did before this existed.
export default function IngredientNameField({
  id,
  value,
  onChange,
  onAdvance,
  suggestions,
  index,
  placeholder,
  className = 'field',
}) {
  const [focused, setFocused] = useState(false)
  // Escape closes the strip and it STAYS closed until the field is left and
  // re-entered. Reopening on the next keystroke — the letter-of-the-spec
  // behaviour — would make Escape useless to someone whose ingredient simply
  // isn't in any list and who wants the row quiet while they finish typing it.
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()

  const matches = useMemo(
    () => matchIngredients(value, suggestions),
    [value, suggestions],
  )
  const open = focused && !dismissed && matches.length > 0
  const activeId = active >= 0 && open ? `${listId}-${active}` : undefined

  function accept(name) {
    onChange(name)
    setActive(-1)
    setDismissed(true)
    // Completing the name is only half the row, so land on the amount rather
    // than leaving the user to reach for it — that's the tap this saves.
    onAdvance?.()
  }

  function handleKeyDown(e) {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      // Down/Up rather than Right/Left even though the strip reads horizontally:
      // the sideways arrows belong to the caret while there's text in the field,
      // and stealing them would break editing a half-typed word.
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((prev) => {
        const next = prev + delta
        if (next < 0) return -1
        return next >= matches.length ? matches.length - 1 : next
      })
      return
    }
    if (e.key === 'Escape') {
      if (open) {
        // Only swallow Escape when there was actually something to close, so it
        // still reaches anything outside that listens for it.
        e.preventDefault()
        setDismissed(true)
        setActive(-1)
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (open && active >= 0) {
        accept(matches[active])
      } else {
        // No highlighted suggestion means the typed words are the answer —
        // Enter keeps its existing meaning and moves on to the amount.
        onAdvance?.()
      }
    }
  }

  return (
    <>
      {/* `relative` + `pr-11` on the input: the mic sits in the field's
          bottom-right corner and the reserved padding keeps a long name from
          running under it — the same pairing every dictatable field uses. */}
      <div className="relative">
        <input
          id={id}
          type="text"
          data-ingredient-name
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // Deliberately does NOT clear `dismissed`: Escape has to survive the
            // next keystroke or it's worthless to the person it's for — someone
            // typing an ingredient no list knows, who wants the row to go quiet
            // while they finish. Leaving and re-entering the field reopens it.
            setActive(-1)
          }}
          onFocus={() => {
            setFocused(true)
            setDismissed(false)
          }}
          onBlur={() => {
            setFocused(false)
            setActive(-1)
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          className={`${className} pr-11`}
        />
        <DictateButton
          value={value}
          onChange={onChange}
          what={`ingredient ${index + 1}`}
          // Finishing dictation lands on the amount — the same place Enter and a
          // tapped suggestion go, so speaking the name flows straight into it.
          onDone={onAdvance}
        />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={`Suggestions for ingredient ${index + 1}`}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-1.5 pb-1"
        >
          {matches.map((name, i) => (
            <div
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Prevented mousedown = no blur = the keyboard stays up and the
              // strip is still there for the next row.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => accept(name)}
              className={`chip flex-shrink-0 whitespace-nowrap cursor-pointer text-[12px] px-3 py-[5px] ${
                // The highlighted option is marked by POSITION as well as
                // colour — it lifts off the row and keeps a shadow the others
                // don't have — so the state survives a screen or a pair of eyes
                // that can't tell terra from cream.
                i === active
                  ? 'chip--active -translate-y-[2px] shadow-[0_2px_0_#2E3A24]'
                  : ''
              }`}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
