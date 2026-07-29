import { useState } from 'react'
import { isImprecise, impreciseLabel } from '../lib/measures'
import CoverImage from './CoverImage'
import MarkerTitle from './MarkerTitle'

// The recipe "body" — the always-readable heart of the recipe detail page.
//
// Renders: cover photo (or the peach issei. CoverImage fallback when there's no photo),
// the story in Caveat if present, an Ingredients section (amounts in bold serif;
// imprecise/unmeasured amounts get a small plum "their way" pill — imprecise
// measures are TRUTH, celebrated, never normalized), and a Steps section with
// clean serif numerals (CSS counter, option F: no circle, no period — see
// .r2-steps in index.css).

// A Fraunces section header with a terra rule fading out — the kitchen look.
function SecHead({ children }) {
  return (
    <div className="flex items-center gap-2.5 mt-6 mb-2.5">
      <h4 className="font-display font-black text-[21px] text-ink m-0 tracking-[0.2px] whitespace-nowrap">
        {children}
      </h4>
      <span className="flex-1 h-0.5 rounded-full bg-ink/25" />
    </div>
  )
}

export default function RecipeBody({ recipe }) {
  // Cooking mode: default OFF (rich — story + their words woven in, the product
  // thesis). Toggling ON strips to clean ingredients + numbered steps for a
  // distraction-free cook. Rich-by-default honors the soul; one tap = focus.
  const [cooking, setCooking] = useState(false)

  // Direct-FK ingredients + sectioned ingredients, merged and ordered by position.
  const allIngredients = [
    ...(recipe.ingredients || []),
    ...(recipe.ingredient_sections || []).flatMap((s) =>
      s.ingredients.map((ing) => ({ ...ing, sectionName: s.name })),
    ),
  ].sort((a, b) => a.position - b.position)

  const sortedSteps = [...(recipe.steps || [])].sort(
    (a, b) => a.position - b.position,
  )

  // Byline: the recorded origin person, else the recipe's own author/keeper.
  // A quiet verb + the person's name emphasized.
  const originName = (recipe.origin_attribution || '').split('·')[0].trim()
  const byline = originName
    ? { verb: 'from', name: originName }
    : recipe.author_full_name
      ? { verb: 'kept by', name: recipe.author_full_name }
      : null

  return (
    <div className="mt-1.5">
      {/* Cooking-mode toggle — an outlined segmented control. Rich by default. */}
      <div className="flex justify-center mb-3">
        <div className="inline-flex rounded-full border-2 border-ink bg-cream p-0.5 text-[12px] font-display font-bold">
          <button
            onClick={() => setCooking(false)}
            aria-pressed={!cooking}
            className={
              'px-3.5 py-1.5 rounded-full transition ' +
              (!cooking ? 'bg-terra text-cream' : 'text-ink-soft')
            }
          >
            The whole story
          </button>
          <button
            onClick={() => setCooking(true)}
            aria-pressed={cooking}
            className={
              'px-3.5 py-1.5 rounded-full transition ' +
              (cooking ? 'bg-terra text-cream' : 'text-ink-soft')
            }
          >
            Cooking mode
          </button>
        </div>
      </div>

      {/* Cover photo (or the peach issei. fallback) — a sticker frame. Hidden in
          cooking mode. */}
      {!cooking && (
        <div className="sticker overflow-hidden mb-1.5 mt-0.5 bg-card">
          <CoverImage
            url={recipe.cover_photo_url}
            size="lg"
            className="w-full h-[180px] object-cover block"
          />
        </div>
      )}

      {/* Byline + cuisine + servings — whose recipe this is, what kind, how many
          it serves. Fraunces throughout (plum heart for the person, fork+knife
          for cuisine, bowl for servings). Hidden in cooking mode. */}
      {!cooking && (byline || recipe.cuisine || recipe.servings) && (
        <div className="flex items-center justify-center gap-[9px] flex-wrap mt-3 mb-1">
          {byline && (
            <span className="inline-flex items-center gap-[5px] text-[13px] tracking-[0.2px]">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-[13px] h-[13px]">
                <path
                  d="M12 20s-7-4.6-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.4 12 20 12 20Z"
                  fill="#8A3D5A"
                />
              </svg>
              <span className="font-display italic text-ink-soft">{byline.verb}</span>
              <span className="font-display font-bold italic text-plum">
                {byline.name}
              </span>
            </span>
          )}
          {byline && recipe.cuisine && (
            <span className="w-px h-[13px] bg-line inline-block" />
          )}
          {recipe.cuisine && (
            <span className="inline-flex items-center gap-1.5 font-display font-bold text-[11.5px] tracking-[0.5px] uppercase text-ink-soft">
              {/* fork + knife */}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-3.5 h-3.5 opacity-90">
                <path d="M8 3v7M6 3v4a2 2 0 0 0 4 0V3M8 10v11" stroke="#4A5540" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3c-1.6 0-2.5 2-2.5 5S15 13 16 13m0-10v18" stroke="#4A5540" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {recipe.cuisine}
            </span>
          )}
          {(byline || recipe.cuisine) && recipe.servings && (
            <span className="w-px h-[13px] bg-line inline-block" />
          )}
          {recipe.servings && (
            <span className="inline-flex items-center gap-1.5 font-display font-bold text-[11.5px] tracking-[0.5px] uppercase text-ink-soft">
              {/* serving bowl */}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-3.5 h-3.5 opacity-90">
                <path d="M4 11h16a8 8 0 0 1-16 0Z" stroke="#4A5540" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M12 4v3M9.5 5v2M14.5 5v2" stroke="#4A5540" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Serves {recipe.servings}
            </span>
          )}
        </div>
      )}

      {/* Description — a short "what is this dish" line. Hidden in cooking mode. */}
      {!cooking && recipe.description && (
        <p className="font-display text-[14.5px] leading-[1.4] text-ink-soft text-center mt-2 mb-1 px-2">
          {recipe.description}
        </p>
      )}

      {/* THE STORY — the heart of the recipe: the person's voice, treated as a
          treasured note on a peach sticker card (not body copy). Heading is a
          chunky saffron marker swipe; attributed to the source when we know
          them. Hidden in cooking mode. (Saffron = voice/memory; plum stays
          reserved for the person's name.) */}
      {!cooking && recipe.story && (
        <div className="sticker bg-peach px-4 pt-4 pb-4 mt-5 mb-1 relative">
          {/* oversized opening quote as a warm decorative stamp */}
          <span
            aria-hidden="true"
            className="absolute right-6 top-4 font-display font-black text-[56px] leading-none text-saffron select-none pointer-events-none"
          >
            &rdquo;
          </span>
          <MarkerTitle
            as="h4"
            color="bg-saffron"
            className="font-display font-black text-[19px] text-ink leading-none"
          >
            {byline && byline.verb === 'from'
              ? `In ${byline.name}'s words`
              : 'The story'}
          </MarkerTitle>
          <p className="font-hand text-[24px] leading-[1.28] text-ink whitespace-pre-line mt-3 pr-6">
            {recipe.story}
          </p>
        </div>
      )}

      <SecHead>Ingredients</SecHead>
      <ul className="list-none m-0 p-0">
        {allIngredients.map((ing, idx) => (
          <li
            key={ing.id ?? idx}
            className="flex items-baseline justify-between gap-2 py-2 text-[14.5px] text-ink border-b border-dashed border-line last:border-b-0"
          >
            <span className="text-ink">{ing.name}</span>
            <span className="flex items-baseline flex-wrap justify-end gap-1.5 text-right flex-shrink-0 font-display font-black text-[15px] text-ink">
              {ing.quantity_text}
              {isImprecise(ing) && (
                <span className="font-display font-bold text-[10.5px] tracking-[0.3px] lowercase text-cream bg-plum border-2 border-ink rounded-full px-2 py-0.5 leading-tight whitespace-nowrap">
                  {impreciseLabel(ing)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <SecHead>Steps</SecHead>
      <ol className="r2-steps">
        {sortedSteps.map((step, idx) => (
          <li
            key={step.id ?? idx}
            className="relative text-[14.5px] text-ink leading-[1.5] py-2.5 pl-9 border-b border-dashed border-line last:border-b-0"
          >
            {step.content}
            {/* The person's words for THIS step — a tinted saffron callout card
                with a decorative quote stamp, clearly separated from the
                instruction so the step stays readable. Hidden in cooking mode. */}
            {!cooking && step.voice_note && step.voice_note.trim() && (
              <span className="block relative mt-2.5 bg-saffron/20 border-2 border-ink rounded-[14px] pl-11 pr-3 py-2.5 shadow-[0_2px_0_#2E3A24] overflow-hidden">
                {/* quote stamp — a saffron disc with a big quote mark */}
                <span
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-saffron border-2 border-ink"
                >
                  <span className="font-display font-black text-ink text-[15px] leading-none mt-1.5">
                    &rdquo;
                  </span>
                </span>
                <span className="block font-display font-bold text-[9.5px] uppercase tracking-[0.12em] text-ink/70 mb-0.5">
                  their words
                </span>
                <span className="font-hand text-[18px] leading-[1.25] text-ink">
                  {step.voice_note.trim()}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
