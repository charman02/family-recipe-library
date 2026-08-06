import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import BackButton from './BackButton'
import DictateButton from './DictateButton'
import IngredientNameField from './IngredientNameField'
import AmountUnitChips from './AmountUnitChips'
import Icon from './Icon'
import { mergeSuggestions } from '../lib/commonIngredients'
import { parseQuantity } from '../utils/quantity'
import { createUploader, PHOTO_ACCEPT } from '../lib/photoUpload'

// One question at a time, instead of a form nineteen fields long.
//
// WHY A THIRD DOOR. The form works for someone who has the whole recipe in front of
// them; pasting works for someone who has it as text. Neither works for the input this
// app most exists to capture — a person telling you how they make it. There, run-on
// speech defeats the paste parser (one sentence holds three ingredients) and the long
// form asks you to hold the entire recipe in your head while scrolling. Being ASKED
// "what goes in it?" and answering one thing at a time is the only shape that fits.
//
// WHY IT'S NOT THE DEFAULT. Testers rejected multi-step flows once already: an earlier
// version put the source fields on their own screen and one person abandoned partway,
// so that screen was folded into the form. The lesson wasn't "never sequence" — it was
// that a step which only collects OPTIONAL fields is pure friction. So:
//   · every screen here is skippable, and says so
//   · the ingredient and step screens LOOP rather than adding screens, so a ten-
//     ingredient recipe is still five screens
//   · it never blocks: "Done for now" saves whatever exists from any screen onward
//
// It shares RecipeForm's actual field components (IngredientNameField for autosuggest,
// AmountUnitChips for tappable units) rather than reimplementing them, so the two doors
// can't drift apart in behaviour.

const STEPS = ['name', 'from', 'ingredients', 'steps', 'extras', 'finish']

// A screen's worth of chrome: the progress dots, a question, and the answer area.
function Screen({ index, total, title, hint, children, onBack, onSkip, skipLabel }) {
  return (
    <div className="min-h-screen bg-cream px-[18px] pt-5 pb-28">
      <div className="mb-5 flex items-center justify-between">
        <BackButton onClick={onBack} label="Back" />
        {/* Position, not a percentage. "3 of 5" is a promise about how much is left;
            a progress bar filling by field count would keep moving without ever
            arriving, because the ingredient screen loops. */}
        <span className="font-display italic text-[12.5px] text-ink-soft">
          {index + 1} of {total}
        </span>
      </div>

      <div className="flex gap-1.5 mb-7" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] flex-1 rounded-full border-2 border-ink ${
              i <= index ? 'bg-terra' : 'bg-cream'
            }`}
          />
        ))}
      </div>

      <h1 className="font-display font-black text-[27px] text-ink leading-tight">
        {title}
      </h1>
      {hint && (
        <p className="font-display italic text-[14px] text-ink-soft mt-2">{hint}</p>
      )}

      <div className="mt-6">{children}</div>

      {/* Directly under the content, NOT pushed to the bottom of a full-height flex
          column — that put it below the fold on a short screen, hiding the one control
          that makes every question escapable. pb-28 above clears the floating nav. */}
      {onSkip && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSkip}
            className="font-display italic text-[14px] text-ink-soft underline decoration-line underline-offset-4"
          >
            {skipLabel || 'Skip this'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function GuidedRecipe({ onDone, onBack }) {
  const [screen, setScreen] = useState(0)
  const [name, setName] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps] = useState([])
  // The row being composed right now. Kept apart from the committed list so the
  // in-progress answer can be discarded by skipping without touching what's confirmed.
  const [draftName, setDraftName] = useState('')
  const [draftAmount, setDraftAmount] = useState('')
  const [draftStep, setDraftStep] = useState('')
  const [suggestions, setSuggestions] = useState(() => mergeSuggestions([]))
  const [saving, setSaving] = useState(false)
  // The extras. Servings is NOT cosmetic: GET /recipes/{id}/scale returns 400 without
  // it, so a recipe saved through this door could never be scaled at all — which is
  // most of the reason this screen exists rather than leaving all three to the form.
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('')
  const [servings, setServings] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  // Shared with RecipeForm rather than reimplemented — it carries the per-slot request
  // ticket and abort that stop a re-picked photo being overwritten by the earlier
  // upload landing last. See lib/photoUpload.js.
  const uploader = useRef(createUploader())

  // The user's own ingredient vocabulary, same source the form uses. Failure is silent
  // and harmless: mergeSuggestions([]) already holds the shipped common list.
  useEffect(() => {
    client
      .get('/recipes/ingredient-suggestions')
      .then((res) => setSuggestions(mergeSuggestions(res.data?.names || [])))
      .catch(() => {})
  }, [])

  // "Whose is this?" is ALWAYS asked, and always skippable.
  //
  // A first version hid it unless originMode === 'ancestor', which made this door
  // unusable on its own: entered straight from the doorway there is no origin mode, so
  // the screen vanished and there was no way to attribute the dish at all — in an app
  // whose entire point is that a recipe comes from a person. Asking with a visible
  // "it's mine" escape costs one tap and keeps the door self-contained.
  const at = STEPS[Math.min(screen, STEPS.length - 1)]
  const go = (n) => setScreen((s) => Math.max(0, Math.min(s + n, STEPS.length - 1)))

  function back() {
    if (screen === 0) onBack()
    else go(-1)
  }

  function commitIngredient() {
    const n = draftName.trim()
    if (!n) return
    setIngredients((prev) => [...prev, { name: n, quantity: draftAmount.trim() }])
    setDraftName('')
    setDraftAmount('')
    // Refocus the name field so the next ingredient is zero taps: the keyboard stays
    // up and you just keep talking or typing. This is what makes a ten-ingredient
    // recipe five screens instead of fifteen. Focused by id because
    // IngredientNameField exposes one — an earlier version held a ref that was never
    // attached to any element, so the refocus silently did nothing and every extra
    // ingredient cost a tap to get back into the field.
    requestAnimationFrame(() =>
      document.getElementById('guided-ingredient')?.focus(),
    )
  }

  function commitStep() {
    const c = draftStep.trim()
    if (!c) return
    setSteps((prev) => [...prev, c])
    setDraftStep('')
  }

  // Save whatever exists. Reachable from any screen from the second onward, so a
  // half-finished recipe is never lost — which is the failure that motivated all of
  // this. Flushes an in-progress draft first, so a typed-but-unconfirmed row counts.
  async function save() {
    if (saving) return
    setSaving(true)
    const ing = [...ingredients]
    if (draftName.trim()) ing.push({ name: draftName.trim(), quantity: draftAmount.trim() })
    const st = [...steps]
    if (draftStep.trim()) st.push(draftStep.trim())

    try {
      await onDone({
        name: name.trim(),
        sourceName: sourceName.trim(),
        coverPhotoUrl,
        servings: servings.trim(),
        cuisine: cuisine.trim(),
        ingredients: ing.map((i, position) => ({
          name: i.name,
          position,
          ...parseQuantity(i.quantity),
        })),
        steps: st.map((content, i) => ({ position: i, content })),
      })
    } finally {
      setSaving(false)
    }
  }

  // Present from the second screen on: by then there's a dish name, which is all a
  // recipe needs to exist.
  const doneNow =
    screen > 0 && name.trim() ? (
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="font-display font-bold text-[13.5px] text-terra"
        >
          {saving ? 'Keeping…' : 'Keep what I have so far →'}
        </button>
      </div>
    ) : null

  if (at === 'name') {
    return (
      <Screen
        index={screen}
        total={STEPS.length}
        title="What did you make?"
        hint="The dish, as you'd say it out loud."
        onBack={back}
      >
        <div className="relative">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) go(1)
            }}
            placeholder="e.g. “Adobo”"
            className="field pr-11 text-[17px]"
          />
          <DictateButton value={name} onChange={setName} what="the dish name" />
        </div>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => go(1)}
          className="btn-primary mt-5"
        >
          Next &rarr;
        </button>
      </Screen>
    )
  }

  if (at === 'from') {
    return (
      <Screen
        index={screen}
        total={STEPS.length}
        title={`Whose ${name.trim() || 'recipe'} is this?`}
        hint="The person you got it from. A first name is plenty."
        onBack={back}
        onSkip={() => go(1)}
        skipLabel="It's my own recipe"
      >
        <div className="relative">
          <input
            autoFocus
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go(1)
            }}
            placeholder="e.g. “Lola Remedios”"
            className="field pr-11 text-[17px]"
          />
          <DictateButton
            value={sourceName}
            onChange={setSourceName}
            what="their name"
          />
        </div>
        <button type="button" onClick={() => go(1)} className="btn-primary mt-5">
          Next &rarr;
        </button>
        {doneNow}
      </Screen>
    )
  }

  if (at === 'ingredients') {
    return (
      <Screen
        index={screen}
        total={STEPS.length}
        title="What goes in it?"
        hint="One at a time. Amounts however you say them — “a splash” is perfect."
        onBack={back}
        onSkip={() => go(1)}
        skipLabel={ingredients.length ? "That's everything" : 'Skip the ingredients'}
      >
        {/* Confirmed rows read back as a plain list, so the answer so far is visible
            without occupying the input. */}
        {ingredients.length > 0 && (
          <ul className="mb-5 space-y-1.5">
            {ingredients.map((i, idx) => (
              <li
                key={`${i.name}-${idx}`}
                className="flex items-baseline justify-between gap-3 border-b-2 border-line pb-1.5"
              >
                <span className="font-display font-bold text-[14.5px] text-ink">
                  {i.name}
                </span>
                <span className="flex items-baseline gap-2.5 flex-none">
                  <span className="font-display italic text-[13px] text-ink-soft">
                    {i.quantity || 'no amount'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${i.name}`}
                    onClick={() =>
                      setIngredients((prev) => prev.filter((_, k) => k !== idx))
                    }
                    className="font-display font-bold text-[15px] text-ink-soft leading-none"
                  >
                    &times;
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <IngredientNameField
          id="guided-ingredient"
          value={draftName}
          onChange={setDraftName}
          onAdvance={() => document.getElementById('guided-amount')?.focus()}
          suggestions={suggestions}
          index={ingredients.length}
          placeholder="e.g. soy sauce"
        />

        <div className="mt-3">
          <input
            id="guided-amount"
            value={draftAmount}
            onChange={(e) => setDraftAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitIngredient()
              }
            }}
            placeholder="1/2 cup · a dash · to taste"
            className="field"
          />
          <AmountUnitChips
            value={draftAmount}
            onPick={(unit) =>
              setDraftAmount((v) => (v ? `${v.trimEnd()} ${unit}` : unit))
            }
            onDone={commitIngredient}
            index={ingredients.length}
          />
        </div>

        <button
          type="button"
          onClick={commitIngredient}
          disabled={!draftName.trim()}
          className="btn-primary mt-4"
        >
          Add ingredient
        </button>
        {doneNow}
      </Screen>
    )
  }

  if (at === 'steps') {
    return (
      <Screen
        index={screen}
        total={STEPS.length}
        title="How do you make it?"
        hint="One step at a time. Say it the way you'd tell someone."
        onBack={back}
        onSkip={() => go(1)}
        skipLabel={steps.length ? "That's the last step" : 'Skip the steps'}
      >
        {steps.length > 0 && (
          <ol className="mb-5 space-y-2">
            {steps.map((s, idx) => (
              <li key={`${s}-${idx}`} className="flex gap-2.5">
                <span className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-saffron border-2 border-ink font-display font-black text-[12px] text-ink">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 font-display text-[14px] text-ink leading-snug">
                  {s}
                </span>
                <button
                  type="button"
                  aria-label={`Remove step ${idx + 1}`}
                  onClick={() => setSteps((prev) => prev.filter((_, k) => k !== idx))}
                  className="flex-none font-display font-bold text-[15px] text-ink-soft leading-none"
                >
                  &times;
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="relative">
          <textarea
            autoFocus
            value={draftStep}
            onChange={(e) => setDraftStep(e.target.value)}
            onKeyDown={(e) => {
              // Enter commits; Shift+Enter is a real newline, since a step can run long.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitStep()
              }
            }}
            rows={3}
            placeholder={`Step ${steps.length + 1}…`}
            className="field pr-11 resize-y"
          />
          <DictateButton
            value={draftStep}
            onChange={setDraftStep}
            what="this step"
            bottomClass="bottom-3.5"
          />
        </div>

        <button
          type="button"
          onClick={commitStep}
          disabled={!draftStep.trim()}
          className="btn-primary mt-4"
        >
          Add step
        </button>
        {doneNow}
      </Screen>
    )
  }

  if (at === 'extras') {
    // The three things this door would otherwise never collect. Without it a guided
    // recipe had NO photo (so its card falls back to a quote or a monogram) and no
    // servings, which means /scale rejects it outright — a whole feature quietly
    // unavailable depending on which door you came in by. One screen, all three
    // optional, so the shortcut stops producing thinner recipes than the long form.
    return (
      <Screen
        index={screen}
        total={STEPS.length}
        title="Anything else?"
        hint="All optional — skip it and keep going."
        onBack={back}
        onSkip={() => go(1)}
        skipLabel="Nothing else"
      >
        <label
          className={`flex flex-col items-center justify-center w-full sticker sticker-press bg-peach px-4 py-6 cursor-pointer ${
            photoBusy ? 'opacity-70' : ''
          }`}
        >
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            aria-label="Add a photo of the dish"
            className="sr-only"
            onChange={(e) =>
              uploader.current.upload({
                slot: 'cover',
                event: e,
                onBusy: setPhotoBusy,
                onError: setPhotoError,
                onUrl: setCoverPhotoUrl,
              })
            }
          />
          {coverPhotoUrl ? (
            <img
              src={coverPhotoUrl}
              alt=""
              className="w-full h-[130px] object-cover rounded-[12px] border-2 border-ink"
            />
          ) : (
            <>
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-cream border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] text-ink -rotate-[6deg]">
                <Icon name="camera" className="w-6 h-6" />
              </span>
              <span className="font-display font-black text-[16px] text-ink mt-2.5 leading-none">
                {photoBusy ? 'Uploading…' : 'Add a photo'}
              </span>
            </>
          )}
        </label>
        {photoError && (
          <p className="mt-2">
            <span className="error-pill">{photoError}</span>
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <label className="flex-1">
            <span className="section-label block mb-1.5">Serves</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="4"
              className="field"
            />
          </label>
          <label className="flex-1">
            <span className="section-label block mb-1.5">Cuisine</span>
            <input
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="Filipino"
              className="field"
            />
          </label>
        </div>
        {/* Says what servings BUYS, because it's the only one of the three that
            unlocks behaviour rather than just labelling the dish. */}
        <p className="font-display italic text-[12.5px] text-ink-soft mt-2">
          Serves is what lets the recipe be scaled up or down later.
        </p>

        <button type="button" onClick={() => go(1)} className="btn-primary mt-5">
          Next
        </button>
        {doneNow}
      </Screen>
    )
  }

  // finish
  return (
    <Screen
      index={screen}
      total={STEPS.length}
      title="That's it — keep it?"
      hint="Private to start. You can send it to someone right after."
      onBack={back}
    >
      <div className="sticker bg-card overflow-hidden">
        {coverPhotoUrl && (
          <img
            src={coverPhotoUrl}
            alt=""
            className="w-full h-[120px] object-cover block border-b-[2.5px] border-ink"
          />
        )}
        <div className="px-4 py-4">
        <p className="font-display font-black text-[19px] text-ink leading-tight">
          {name.trim() || 'Untitled'}
        </p>
        {sourceName.trim() && (
          <p className="text-[13.5px] mt-0.5">
            <span className="font-sans text-ink-soft/80">from </span>
            <span className="font-display font-bold italic text-plum">
              {sourceName.trim()}
            </span>
          </p>
        )}
        <p className="font-display italic text-[13.5px] text-ink-soft mt-3">
          {ingredients.length || 'No'}{' '}
          {ingredients.length === 1 ? 'ingredient' : 'ingredients'} &middot;{' '}
          {steps.length || 'no'} {steps.length === 1 ? 'step' : 'steps'}
          {servings.trim() && ` · serves ${servings.trim()}`}
        </p>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !name.trim()}
        className="btn-primary mt-5"
      >
        {saving ? 'Keeping…' : 'Keep this recipe'}
      </button>
    </Screen>
  )
}
