// The name, glossed in one clause.
//
// A single source for this sentence because it appears at both cold entry points
// (the login panel and the bottom of an invite landing) and the two must not
// drift apart — a name explained two different ways is a name nobody learns.
//
// The gloss deliberately does not stop at the translation. "First generation" is
// trivia; the second half turns it into the reason the app exists, which is what
// makes the word stick. The pill renders 一世 so the characters are seen, not
// just described.
export default function IsseiMeaning({ className = '' }) {
  return (
    <p
      className={`font-display text-[13.5px] leading-relaxed text-ink-soft ${className}`}
    >
      <span className="inline-block font-display font-black text-[11.5px] text-ink bg-cream border-2 border-ink rounded-full px-2.5 py-0.5 -rotate-2 mr-1.5 align-middle">
        一世 · issei
      </span>
      the first of a family to arrive somewhere new — usually the one who never
      wrote any of it down.
    </p>
  )
}
