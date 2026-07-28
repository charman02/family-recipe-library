import { useState, useRef, useEffect } from 'react'

// A sticker-style dropdown filter. Uses a custom button + panel (not a native
// <select>) so the OPEN state matches the sticker language — the native option
// list is OS-chrome that can't be styled and clashed with the buttons. A small
// stacked label sits above, like the reference site's "Ready In / By Type"
// dropdowns, so a chosen value never loses its meaning.
export default function FilterSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((o) => o.value === value) || options[0]

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="flex-1 min-w-[104px]" ref={ref}>
      <span className="block font-display font-bold text-[10.5px] uppercase tracking-[0.12em] text-ink-soft mb-1">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between font-display font-bold text-[13px] text-ink bg-cream border-2 border-ink rounded-full pl-3 pr-2.5 py-2 shadow-[0_3px_0_#2E3A24] focus:outline-none focus:ring-4 focus:ring-terra/25"
        >
          <span className="truncate">{selected.label}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={`w-4 h-4 flex-none text-ink transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute z-30 left-0 right-0 mt-2 max-h-64 overflow-auto rounded-[16px] border-2 border-ink bg-cream shadow-[0_4px_0_#2E3A24] py-1 scrollbar-hide"
          >
            {options.map((opt) => {
              const active = opt.value === value
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={`w-full text-left font-display font-bold text-[13px] px-3.5 py-2 transition-colors ${
                      active ? 'bg-terra text-cream' : 'text-ink hover:bg-peach/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
