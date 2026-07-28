// A friendly empty/no-results state in the sticker language — a peach card with
// a decorative color-disc badge, a chunky line, and an optional sub-line. Keeps
// empty screens feeling intentional and warm rather than bare.
export default function EmptyState({
  icon = '🍥',
  title,
  sub,
  badge = 'bg-saffron',
  className = '',
}) {
  return (
    <div className={`sticker bg-peach px-6 py-8 text-center ${className}`}>
      <span
        className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${badge} border-2 border-ink shadow-[0_3px_0_#2E3A24] text-[26px] leading-none mb-3`}
      >
        {icon}
      </span>
      <p className="font-display font-black text-[19px] text-ink leading-tight">
        {title}
      </p>
      {sub && (
        <p className="font-display italic text-[14px] text-ink-soft mt-1">
          {sub}
        </p>
      )}
    </div>
  )
}
