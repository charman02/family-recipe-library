import { useState, useEffect, useRef } from 'react'
import { isImprecise, impreciseLabel } from '../lib/measures'
import { scaleRecipe } from '../api/sharing'
import CoverImage from './CoverImage'
import MarkerTitle from './MarkerTitle'

// The recipe "body" — the always-readable heart of the recipe detail page.
//
// Renders: cover photo (or the peach issei. CoverImage fallback when there's no
// photo), the description as a standfirst, the story in the hand face if present,
// an Ingredients section (amounts in bold serif; imprecise/unmeasured amounts get
// a small plum "their way" pill — imprecise measures are TRUTH, celebrated, never
// normalized), and a Steps section whose serif numeral doubles as the step's
// check-off control.
//
// Copy note: user testing showed people couldn't decode this screen's labels, so
// the strings here name what you get, not what we call it — "Full recipe" /
// "Ingredients & steps" instead of "Cooking mode", "A note on this step" instead
// of "their words" (there is no audio in this app: Step.voice_note is plain text
// typed by whoever wrote the recipe down, so any wording implying a recording or
// a verbatim quote from the source person would be a lie).
//
// The story and the per-step remarks are the only two places where a *person* is
// talking rather than the app. They're set apart STRUCTURALLY — the saffron card,
// the quote stamp, the attributed heading — not by a handwriting font. Five were
// tried and all cut: this is body content someone cooks from, and the data is
// typed text, so a script face costs legibility to imply something untrue. See
// the note in tailwind.config.js.

// A Fraunces section header with a rule running off to the edge — the kitchen
// look. Held at 19px with generous space ABOVE and tight space below: it should
// read as a divider you scroll past, and it belongs to the list under it. At 21px
// it was nearly the size of a step, which flattened the hierarchy exactly where a
// cook needs to jump between two sections quickly.
function SecHead({ children }) {
  return (
    <div className="flex items-center gap-2.5 mt-9 mb-1">
      <h4 className="font-display font-black text-[19px] text-ink m-0 tracking-[0.2px] whitespace-nowrap">
        {children}
      </h4>
      <span className="flex-1 h-0.5 rounded-full bg-ink/25" />
    </div>
  )
}

// `context` is forwarded to CoverImage's no-photo fallback and nothing else:
// "owner" (the default, so every existing caller is unchanged) shows the add-a-
// photo nudge, "reader" shows a quiet placeholder — see CoverImage for why the
// recipient's page must not get the nudge or a second wordmark.
export default function RecipeBody({ recipe, context = 'owner', scalable = false }) {
  // Which steps the cook has ticked off THIS session. Deliberately not persisted:
  // it's a place-holder for the next ten minutes, not a record — and saving it
  // would raise questions (whose progress? cleared when?) that the feature
  // doesn't need to answer to be useful.
  const [doneSteps, setDoneSteps] = useState(() => new Set())
  const isDone = (step, idx) => doneSteps.has(step.id ?? idx)
  const toggleStep = (key) =>
    setDoneSteps((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  // Steps-only view: default OFF (full — story + step notes woven in, the product
  // thesis). Toggling ON strips to clean ingredients + numbered steps for a
  // distraction-free cook. Rich-by-default honors the soul; one tap = focus.
  const [cooking, setCooking] = useState(false)

  // Serving-size scaling. The stepper below sets a TARGET count; when it differs
  // from the recipe's own servings we fetch GET /recipes/{id}/scale and render the
  // amounts it returns. The scaling is the backend's job on purpose — precise
  // amounts scale by arithmetic, folk units only when the result is still a whole
  // vessel, and a non-linear "3 fingers of water" is kept verbatim with a ×N note
  // for the cook to apply by feel. `scalable` is off by default so the public
  // invite page (which has no authenticated /scale) is unaffected; RecipePage
  // turns it on. A recipe with no servings can't be scaled at all.
  const canScale = scalable && recipe.servings != null && recipe.servings > 0
  const [targetServings, setTargetServings] = useState(recipe.servings ?? null)
  const [scaled, setScaled] = useState(null) // the /scale response, or null at 1×
  const [scaling, setScaling] = useState(false)
  // A recipe change (navigating between recipes reuses this component) resets the
  // stepper to the recipe's own serving count.
  useEffect(() => {
    setTargetServings(recipe.servings ?? null)
    setScaled(null)
  }, [recipe.id, recipe.servings])

  // Guard against a slow response landing after a newer one: only the latest
  // requested target may write state.
  const scaleReqRef = useRef(0)
  useEffect(() => {
    if (!canScale) return
    if (targetServings == null || targetServings === recipe.servings) {
      setScaled(null)
      return
    }
    const reqId = ++scaleReqRef.current
    setScaling(true)
    scaleRecipe(recipe.id, targetServings)
      .then(({ data }) => {
        if (reqId === scaleReqRef.current) setScaled(data)
      })
      .catch(() => {
        // A failed scale falls back to the unscaled amounts rather than showing an
        // error mid-recipe — the original is always correct, just not rescaled.
        if (reqId === scaleReqRef.current) {
          setScaled(null)
          setTargetServings(recipe.servings)
        }
      })
      .finally(() => {
        if (reqId === scaleReqRef.current) setScaling(false)
      })
  }, [targetServings, canScale, recipe.id, recipe.servings])

  // The recipe to READ FROM: the scaled response when active, else the original.
  const shown = scaled || recipe

  // Direct-FK ingredients + sectioned ingredients, merged and ordered by position.
  const allIngredients = [
    ...(shown.ingredients || []),
    ...(shown.ingredient_sections || []).flatMap((s) =>
      s.ingredients.map((ing) => ({ ...ing, sectionName: s.name })),
    ),
  ].sort((a, b) => a.position - b.position)

  const sortedSteps = [...(recipe.steps || [])].sort(
    (a, b) => a.position - b.position,
  )

  // Byline: the recorded origin person, else the recipe's own author/keeper.
  // "from Lola" reads on sight. The fallback used to say "kept by {author}",
  // which testers couldn't decode ("kept" is our word, not theirs) — so the
  // fallback now drops the verb entirely and just names the person, the way a
  // cookbook attributes a dish. A bare name under a dish needs no explaining.
  const originName = (recipe.origin_attribution || '').split('·')[0].trim()
  const byline = originName
    ? { verb: 'from', name: originName }
    : recipe.author_full_name
      ? { verb: null, name: recipe.author_full_name }
      : null

  return (
    <div className="mt-1.5">
      {/* View toggle — an outlined segmented control, full view by default.
          Labels name what each view CONTAINS, because "Cooking mode" told testers
          nothing until they'd tapped it. They also have to be literally true:
          "Just the steps" wasn't — this view keeps the ingredients — so it names
          both lists it shows. That contrast against "Full recipe" is what implies
          the rest (cover, story, notes) is what's dropped, which is why the
          explanatory line under the control could go without losing meaning.
          Per-step technique photos are the one thing kept in BOTH views — they're
          part of the step, not context around it; see the note at the photo. */}
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
            Full recipe
          </button>
          <button
            onClick={() => setCooking(true)}
            aria-pressed={cooking}
            className={
              'px-3.5 py-1.5 rounded-full transition ' +
              (cooking ? 'bg-terra text-cream' : 'text-ink-soft')
            }
          >
            Ingredients &amp; steps
          </button>
        </div>
      </div>

      {/* Cover photo — or, with no photo, a type cover built from this recipe's own
          words (see lib/coverText.js). Hidden in cooking mode.
          avoid="notes": this page lists the steps in full below, so a cover quoting a
          step remark printed the same sentence twice on one screen. It reaches for an
          amount instead — amounts appear in a table here, so a pull quote of one
          doesn't read as duplication. */}
      {!cooking && (
        <div className="sticker overflow-hidden mb-1.5 mt-0.5 bg-card">
          <CoverImage
            url={recipe.cover_photo_url}
            size="lg"
            context={context}
            recipe={recipe}
            avoid="notes"
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="w-[13px] h-[13px]"
              >
                <path
                  d="M12 20s-7-4.6-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.4 12 20 12 20Z"
                  fill="#8A3D5A"
                />
              </svg>
              {byline.verb && (
                <span className="font-display italic text-ink-soft">
                  {byline.verb}
                </span>
              )}
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="w-3.5 h-3.5 opacity-90"
              >
                <path
                  d="M8 3v7M6 3v4a2 2 0 0 0 4 0V3M8 10v11"
                  stroke="#4A5540"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 3c-1.6 0-2.5 2-2.5 5S15 13 16 13m0-10v18"
                  stroke="#4A5540"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="w-3.5 h-3.5 opacity-90"
              >
                <path
                  d="M4 11h16a8 8 0 0 1-16 0Z"
                  stroke="#4A5540"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 4v3M9.5 5v2M14.5 5v2"
                  stroke="#4A5540"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              Serves {recipe.servings}
            </span>
          )}
        </div>
      )}

      {/* Description — the standfirst: "what IS this dish?", the first question a
          reader has, and the only one a recipient who's never tasted it can't
          answer for themselves. It used to render as small ink-soft text stacked
          directly on top of the peach story card, which swallowed it whole. Now
          it's full ink at reading size with its own air and a short terra rule
          closing it off, so it's a paragraph in its own right rather than a
          caption on the block beneath. Hidden in the cooking view. */}
      {!cooking && recipe.description && (
        <div className="mt-4 mb-1 text-center">
          <p className="font-display text-[17px] leading-[1.45] text-ink text-balance px-1">
            {recipe.description}
          </p>
          <span className="inline-block w-10 h-[3px] rounded-full bg-terra mt-3.5" />
        </div>
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
          {/* "In {Name}'s words" claimed the source person wrote this; in fact
              whoever wrote the recipe down typed it (see RecipeForm's story
              field, which asks the recorder who taught them). "{Name}'s story"
              says whose story it is without claiming whose hand typed it. */}
          <MarkerTitle
            as="h4"
            color="bg-saffron"
            className="font-display font-black text-[19px] text-ink leading-none"
          >
            {byline && byline.verb === 'from'
              ? `${byline.name}'s story`
              : 'The story'}
          </MarkerTitle>
          {/* Fraunces italic at a real reading size. The "someone is talking"
              signal comes from the card, the stamp and the attributed heading —
              the type only has to be comfortable to read, since this is often the
              longest passage on the page. */}
          <p className="font-display italic text-[16.5px] leading-[1.62] text-ink whitespace-pre-line mt-3 pr-6">
            {recipe.story}
          </p>
        </div>
      )}

      <SecHead>Ingredients</SecHead>

      {/* Servings stepper — rescales the amounts below to a target count. Only on
          the owner-authenticated page (canScale) and only when the recipe has a
          serving count to scale from. The amounts a person left in their own words
          ("a good splash") don't change — those come back verbatim with a ×N note
          instead, honoring the fidelity rule while still helping the cook. */}
      {canScale && (
        <div className="flex items-center justify-between gap-3 mb-1 mt-0.5">
          <span className="font-display font-bold text-[12.5px] uppercase tracking-[0.08em] text-ink-soft">
            {scaling ? 'Scaling…' : 'Serves'}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Fewer servings"
              disabled={targetServings <= 1}
              onClick={() => setTargetServings((n) => Math.max(1, (n ?? 1) - 1))}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink font-display font-black text-[18px] leading-none shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform disabled:opacity-40 disabled:active:translate-y-0"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="font-display font-black text-[19px] text-ink min-w-[1.5ch] text-center tabular-nums"
            >
              {targetServings}
            </span>
            <button
              type="button"
              aria-label="More servings"
              disabled={targetServings >= 99}
              onClick={() => setTargetServings((n) => Math.min(99, (n ?? 1) + 1))}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink font-display font-black text-[18px] leading-none shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform disabled:opacity-40 disabled:active:translate-y-0"
            >
              +
            </button>
          </div>
        </div>
      )}
      {/* When scaled away from the original, offer a one-tap reset and name the
          starting point, so the change is never a mystery. */}
      {canScale && scaled && targetServings !== recipe.servings && (
        <button
          type="button"
          onClick={() => setTargetServings(recipe.servings)}
          className="font-display italic text-[12px] text-terra underline decoration-line underline-offset-2 mb-1"
        >
          scaled from {recipe.servings} — reset
        </button>
      )}

      <ul className="list-none m-0 p-0">
        {allIngredients.map((ing, idx) => (
          <li
            key={ing.id ?? idx}
            className="flex items-baseline justify-between gap-3 py-2.5 text-[16.5px] text-ink border-b border-dashed border-line last:border-b-0"
          >
            <span className="text-ink">{ing.name}</span>
            <span className="flex items-baseline flex-wrap justify-end gap-1.5 text-right flex-shrink-0 font-display font-black text-[17px] text-ink">
              {ing.quantity_text}
              {/* The multiplier for an amount the scaler deliberately kept verbatim
                  (a non-linear folk measure like "3 fingers of water"): the cook
                  gets the ×N to apply by feel rather than an invented number. */}
              {ing.scale_note && (
                <span className="font-display font-bold text-[10.5px] tracking-[0.3px] text-ink bg-saffron border-2 border-ink rounded-full px-2 py-0.5 leading-tight whitespace-nowrap">
                  {ing.scale_note}
                </span>
              )}
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
      {/* One short line, stated once. The outlined discs read as controls, but
          saying it outright removes any doubt on the first recipe someone cooks —
          the difference between a feature people find and one only we know about.
          It names the ACTION and the RESULT ("tap each number" / "check off
          steps"), because the earlier wording only hinted at the outcome. Hidden
          for a single-step recipe, which has no place to lose. */}
      {sortedSteps.length > 1 && (
        <p className="font-display italic text-[12.5px] text-ink-soft mb-1.5">
          Tap each number as you go to check off steps.
        </p>
      )}
      <ol className="list-none m-0 p-0">
        {sortedSteps.map((step, idx) => (
          <li
            key={step.id ?? idx}
            className="relative border-b border-dashed border-line last:border-b-0"
          >
            {/* The numeral is the check-off control, and it has to LOOK like a
                control. Two earlier attempts failed on discoverability: a bare
                tap-to-dim (no visible affordance at all), then a numeral with the
                state carried only by colour. Both were things only the author knew
                about.

                What makes it read as tappable is the app's own universal signal —
                ink outline + hard offset shadow — which every other button here
                wears. A bordered disc with a shadow is a control on sight, in this
                design language, without needing a second element beside the number
                or a line of instructions above the list. Checked, it fills terra
                with a drawn tick and the shadow collapses, the same press
                behaviour as .sticker-press elsewhere.

                A real <input type="checkbox"> so space toggles it and a screen
                reader announces it by the step's own text; the <label> makes the
                whole row the target, which is what a wet finger needs. */}
            <label
              className={
                'group flex items-start gap-3 cursor-pointer py-3.5 pr-1 transition-colors ' +
                (isDone(step, idx) ? 'text-ink/40' : 'text-ink')
              }
            >
              <input
                type="checkbox"
                checked={isDone(step, idx)}
                onChange={() => toggleStep(step.id ?? idx)}
                className="sr-only peer"
              />
              <span
                aria-hidden="true"
                className={
                  'flex-none mt-[1px] flex items-center justify-center w-[28px] h-[28px] rounded-full border-2 border-ink font-display font-black text-[16px] leading-none transition-all peer-focus-visible:ring-4 peer-focus-visible:ring-terra/30 ' +
                  (isDone(step, idx)
                    ? 'bg-terra text-cream shadow-none translate-y-[2px]'
                    : 'bg-cream text-terra shadow-[0_2px_0_#2E3A24] group-active:translate-y-[2px] group-active:shadow-none')
                }
              >
                {isDone(step, idx) ? (
                  <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="#FBF3E2"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </span>
              <span
                className={
                  'text-[16.5px] leading-[1.55] pt-[4px] ' +
                  (isDone(step, idx) ? 'line-through decoration-ink/30' : '')
                }
              >
                {step.content}
              </span>
            </label>
            {/* The technique photo for THIS step — "fold it like this", "until it
                looks like this". Kept in BOTH views, unlike the note above it,
                and that asymmetry is the point rather than an oversight.

                The cooking view drops the cover, the story and the per-step notes
                because they're PROSE — context you read once before you start,
                which mid-cook is only something else to scroll past. A technique
                photo is the opposite: it answers a question that only arises with
                your hands in the bowl ("is this what translucent looks like?"),
                and it's the single thing text genuinely cannot carry. Hiding it in
                the view people actually cook from would remove it exactly when
                it's needed and leave it only in the view they read beforehand.

                It also matters most for the reader this app exists for — the
                recipient of a handoff, who has never tasted OR seen the dish and
                is cooking it blind from an invite link. That page renders this
                same component with context="reader", so nothing here may depend
                on ownership.

                Sits OUTSIDE the <label> above for the same reason the note does:
                pinching to look closer at a photo must not tick the step off.
                Unstyled `alt` deliberately describes the step it belongs to
                rather than the (unknown) picture; the instruction itself is the
                caption, right above it. */}
            {step.photo_url && (
              <div className="ml-[38px] mr-1 mb-3.5 -mt-0.5">
                <img
                  src={step.photo_url}
                  alt={`Step ${idx + 1}: ${step.content}`}
                  loading="lazy"
                  className={
                    'w-full max-h-[220px] object-cover rounded-[14px] border-2 border-ink block transition-all ' +
                    // Fades and presses in with its step, matching the note card
                    // — but stops at 70%, a notch stronger. A photo is the only
                    // record of what "done" looked like, so a cook checking their
                    // work against it after the fact is a real use, not a stray.
                    (isDone(step, idx)
                      ? 'opacity-70 shadow-none translate-y-[2px]'
                      : 'shadow-[0_2px_0_#2E3A24]')
                  }
                />
              </div>
            )}
            {/* The extra remark for THIS step — a tinted saffron callout card
                with a decorative quote stamp, clearly separated from the
                instruction so the step stays readable. Sits OUTSIDE the tap
                target above: reaching in to read a note shouldn't tick the step
                off, and the note stays selectable. Hidden in the steps-only view.

                Label honesty: this is `Step.voice_note`, a plain text column.
                Nothing is recorded anywhere in this app, and the person who
                typed it is the recorder, not necessarily the cook it came from
                — so "their words" overclaimed twice (a voice, and a verbatim
                quote). "A note on this step" is exactly what it is, and it tells
                a reader-turned-recorder what kind of thing belongs here.

                Checked off, the note fades WITH its step — a finished step used
                to keep a full-strength saffron card hanging off it, which pulled
                the eye back to work already done. The fade is one opacity on the
                whole card so the tint, the outline and the saffron quote stamp
                recede in lockstep; dimming the card's own colours instead left a
                greyed card wearing a bright stamp, which read as broken.

                It stops at 60%, not at the step text's ink/40. A note is a
                paragraph someone may deliberately come back to *because* they've
                done the step and want to check they missed nothing, so finished
                can't mean unusable — it lands a clear notch stronger than the
                struck instruction above it. No strikethrough either: a struck
                multi-line paragraph is hard to read, and done-ness belongs to the
                action, not to the context around it. The hard shadow collapses
                the way the numeral disc's does, so the card presses in with the
                step — a second, non-chromatic cue, since opacity on its own would
                make this a colour-only signal. */}
            {!cooking && step.voice_note && step.voice_note.trim() && (
              <div
                className={
                  'relative ml-[38px] mr-1 mb-3.5 -mt-1 bg-saffron/20 border-2 border-ink rounded-[14px] pl-11 pr-3 py-2.5 overflow-hidden transition-all ' +
                  (isDone(step, idx)
                    ? 'opacity-60 shadow-none translate-y-[2px]'
                    : 'shadow-[0_2px_0_#2E3A24]')
                }
              >
                {/* quote stamp — a saffron disc with a big quote mark */}
                <span
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-saffron border-2 border-ink"
                >
                  <span className="font-display font-black text-ink text-[15px] leading-none mt-1.5">
                    &rdquo;
                  </span>
                </span>
                {/* text-ink/85, not /70: this label is only 9.5px uppercase, and the
                    card dims to 60% when its step is checked — at /70 that
                    compounds to ~42% ink, level with the struck-out instruction
                    and below comfortable for type this small. */}
                <span className="block font-display font-bold text-[9.5px] uppercase tracking-[0.12em] text-ink/85 mb-0.5">
                  a note on this step
                </span>
                {/* A notch smaller than the story: this is an aside on one step,
                    read mid-cook, and must never compete with the instruction it
                    hangs off. Full ink, though — a kitchen is badly lit. */}
                <span className="font-display text-[15px] leading-[1.5] text-ink">
                  {step.voice_note.trim()}
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
