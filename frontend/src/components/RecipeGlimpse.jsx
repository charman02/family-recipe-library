// A miniature, non-interactive sample of a recipe as issei actually renders it.
//
// Why a sample instead of a definition: the login screen already carried a
// dictionary gloss of 一世, and two rounds of user testing still asked "what's
// the point of this app?" while looking straight at it. A definition describes a
// category of person — it never shows what the product DOES. This card shows the
// two things that are genuinely different here: an amount left in the cook's own
// words ("3 soup spoons", never converted to grams), and the remark that carries
// the knowledge the ingredient list can't hold. Shown in the app's own
// vocabulary, so the sample and the real thing are indistinguishable.
//
// The pill/callout styling is deliberately duplicated from RecipeBody rather
// than extracted into a shared part: this is a fixed illustration, not a second
// recipe renderer, and coupling it to the real reading surface would let a
// layout change there silently reshape the pitch.
export default function RecipeGlimpse({ className = '' }) {
  return (
    <figure className={`sticker bg-card px-4 pt-4 pb-4 m-0 ${className}`}>
      {/* Attribution first — a recipe here belongs to a person, not a database.
          Plum is reserved app-wide for a person's name. */}
      <p className="text-[12.5px] leading-none">
        <span className="font-sans text-ink-soft/80">from </span>
        <span className="font-display font-bold italic text-plum">
          Auntie Ling
        </span>
      </p>
      <p className="font-display font-black text-[20px] leading-tight text-ink mt-1">
        Braised pork belly
      </p>

      {/* Two ingredient rows, one exact and one not — the contrast IS the point.
          One row alone would read as sloppiness rather than fidelity. */}
      <ul className="list-none m-0 p-0 mt-2.5">
        <li className="flex items-baseline justify-between gap-2 py-1.5 text-[13.5px] text-ink border-b border-dashed border-line">
          <span>pork belly</span>
          <span className="font-display font-black text-[14px] flex-shrink-0">
            2 lbs
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-2 py-1.5 text-[13.5px] text-ink">
          <span>dark soy sauce</span>
          <span className="flex items-baseline flex-wrap justify-end gap-1.5 text-right flex-shrink-0 font-display font-black text-[14px] text-ink">
            3 soup spoons
            <span className="font-display font-bold text-[10px] tracking-[0.3px] lowercase text-cream bg-plum border-2 border-ink rounded-full px-2 py-0.5 leading-tight whitespace-nowrap">
              their way
            </span>
          </span>
        </li>
      </ul>

      {/* The per-step remark — the knowledge an ingredient list can't hold. */}
      <div className="relative mt-3 bg-saffron/20 border-2 border-ink rounded-[14px] px-3 py-2.5 shadow-[0_2px_0_#2E3A24]">
        <span className="block font-display font-bold text-[9.5px] uppercase tracking-[0.12em] text-ink/70 mb-0.5">
          a note on this step
        </span>
        <span className="font-display text-[13px] leading-[1.5] text-ink/90">
          Wait for the sugar to go the colour of tea. Any darker and it turns
          bitter.
        </span>
      </div>
    </figure>
  )
}
