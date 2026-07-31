// Renders a recipe cover photo, or — when no photo is set — a warm peach
// placeholder in the sticker design language. The prompt text shows at md/lg
// (recipe cards, the detail hero) but is suppressed at sm so small cards read
// cleanly with just the mark. Read surfaces only — the add/edit form renders its
// own photo picker, not this.
const sizes = {
  sm: { mark: 'text-2xl', text: 'text-[10px]', prompt: false },
  md: { mark: 'text-4xl', text: 'text-xs', prompt: true },
  lg: { mark: 'text-6xl', text: 'text-sm', prompt: true },
}

// `context` selects who the fallback is talking to. Default "owner" keeps the
// existing behavior for every owner-facing surface (RecipeCard, the detail hero):
// the wordmark plus a nudge to add a photo, which only an owner can act on.
//
// Pass "reader" on surfaces the viewer doesn't own — the invite landing above all.
// There the prompt is advice to someone with no upload button, and the wordmark is
// a SECOND `issei.` directly under the page's own header wordmark, which reads as
// a rendering bug. So "reader" draws the peach field with a quiet plate glyph
// instead: it still fills the frame and still says "photo goes here", without
// asking the reader for something or repeating the brand.
export default function CoverImage({ url, size = 'md', context = 'owner', className = '' }) {
  if (url) {
    return <img src={url} alt="" className={`object-cover ${className}`} />
  }

  const s = sizes[size] || sizes.md

  if (context === 'reader') {
    return (
      <div
        className={`bg-peach flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        {/* A plate/bowl seen from above — ink at low opacity, so it registers as
            texture in the frame rather than as content competing with the dish
            name above it. */}
        <svg viewBox="0 0 48 48" fill="none" className="w-11 h-11 text-ink/25">
          <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`bg-peach flex flex-col items-center justify-center text-center px-3 ${className}`}
    >
      <span className={`font-display font-black text-ink/80 ${s.mark}`}>
        issei<span className="text-terra">.</span>
      </span>
      {s.prompt && (
        <span className={`text-ink/70 mt-1.5 leading-tight font-display italic ${s.text}`}>
          A photo brings this dish to life
        </span>
      )}
    </div>
  )
}
