// A persistent field label — stays visible after the field is filled, so a
// value never loses its meaning (the placeholder-only problem). `accent` tints
// the label + a leading dot to mark a "secondary" field in a pair (a
// measurement beside an ingredient, a personal note beside a step).
export default function FieldLabel({ children, accent }) {
  const color =
    accent === 'plum'
      ? 'text-plum'
      : accent === 'terra'
        ? 'text-terra'
        : 'text-ink-soft'
  return (
    <span
      className={`flex items-center gap-1 font-display font-bold text-[10.5px] uppercase tracking-[0.1em] mb-1 ${color}`}
    >
      {accent && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${accent === 'plum' ? 'bg-plum' : 'bg-terra'}`}
        />
      )}
      {children}
    </span>
  )
}
