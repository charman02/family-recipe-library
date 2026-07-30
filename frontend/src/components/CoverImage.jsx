// Renders a recipe cover photo, or — when no photo is set — a warm peach
// placeholder carrying the issei. wordmark, in the sticker design language.
// The prompt text shows at md/lg (recipe cards, the detail hero) but is
// suppressed at sm so small cards read cleanly with just the mark. Read
// surfaces only — the add/edit form renders its own photo picker, not this.
const sizes = {
  sm: { mark: 'text-2xl', text: 'text-[10px]', prompt: false },
  md: { mark: 'text-4xl', text: 'text-xs', prompt: true },
  lg: { mark: 'text-6xl', text: 'text-sm', prompt: true },
}

export default function CoverImage({ url, size = 'md', className = '' }) {
  if (url) {
    return <img src={url} alt="" className={`object-cover ${className}`} />
  }

  const s = sizes[size] || sizes.md
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
