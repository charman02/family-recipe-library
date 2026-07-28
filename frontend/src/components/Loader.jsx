// A full-screen loading state in the sticker language — a bobbing pot badge over
// a cream field. Replaces bland "Loading…" text so every wait feels on-brand.
export default function Loader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
      <span className="flex items-center justify-center w-16 h-16 rounded-full bg-saffron border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] animate-bounce">
        {/* cooking pot */}
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-8 h-8 text-ink" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3.5c0 1-1 1.5-1 2.5M13 3c0 1.2-1.2 1.7-1.2 2.9" strokeWidth="1.5" />
          <path d="M4.5 9.5h15M12 7.4v2M6 9.5h12l-.8 8.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8zM6 11.5H4.4M18 11.5h1.6" />
        </svg>
      </span>
      <p className="font-display italic text-[15px] text-ink-soft">{label}</p>
    </div>
  )
}
