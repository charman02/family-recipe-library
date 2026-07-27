// Section header used across Home and Browse: an uppercase Inter label, a
// hairline rule filling the remaining width, and — optionally — a small terra
// `issei.` seal at the end. The seal marks the app's own curated sections
// (Home); cuisine/section rows on Browse omit it (seal={false}).
export default function SectionHeader({
  children,
  seal = true,
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2.5 mb-3 ${className}`}>
      <span className="section-label whitespace-nowrap">{children}</span>
      <span className="h-0.5 flex-1 bg-ink/25 rounded-full" />
      {seal && (
        <span className="font-display font-black text-xs text-terra">
          issei<span className="text-terra">.</span>
        </span>
      )}
    </div>
  )
}
