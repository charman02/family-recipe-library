import { useId, useMemo, useState } from 'react'
import { matchIngredients } from '../lib/commonIngredients'
import DictateButton from './DictateButton'

// A single-line text input with an autosuggest strip + a dictation mic — the
// general-purpose sibling of IngredientNameField. Used for the recipe form's
// "Passed down from" and "Cuisine" fields.
//
// WHY REUSE THE STRIP PATTERN (not a dropdown): same constraint as the ingredient
// field — one-handed, on a phone, keyboard up. An absolutely-positioned menu lands
// under the keyboard or over the next field, so suggestions live IN the layout flow
// as a horizontally-scrolling row beneath the input. `matchIngredients` is a
// misnomer for "cuisine"/"source" but its logic is generic (rank any string pool by
// prefix then word-start), so it's reused rather than duplicated.
//
// Free text always wins: the strip is advisory, never fills the field on its own,
// Escape closes it, and a value no list has heard of types exactly as before.
export default function SuggestField({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  label, // for the dictation button's accessible name ("Dictate {label}")
  onDone, // fired when a dictation session ends with captured text (focus advance)
  listLabel = 'Suggestions',
}) {
  const [focused, setFocused] = useState(false)
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
  }

  function handleKeyDown(e) {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
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
        e.preventDefault()
        setDismissed(true)
        setActive(-1)
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && open && active >= 0) {
      // Only intercept Enter to accept a highlighted suggestion; otherwise leave
      // it alone (no row-advance semantics here, unlike the ingredient field).
      e.preventDefault()
      accept(matches[active])
    }
  }

  return (
    <>
      {/* relative + pr-11: the mic sits bottom-right; the padding keeps text off it. */}
      <div className="relative">
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
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
          className="field pr-11"
        />
        <DictateButton value={value} onChange={onChange} what={label} onDone={onDone} />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-1.5 pb-1"
        >
          {matches.map((name, i) => (
            <div
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => accept(name)}
              className={`chip flex-shrink-0 whitespace-nowrap cursor-pointer text-[12px] px-3 py-[5px] ${
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
