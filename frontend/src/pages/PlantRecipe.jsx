import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm'
import PasteRecipe from '../components/PasteRecipe'
import HandoffInvite from '../components/HandoffInvite'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import VisibilityChoice from '../components/VisibilityChoice'
import SourceFields from '../components/SourceFields'
import { buildOriginPayload } from '../lib/originPayload'
import { plantRecipe } from '../api/sharing'

// The add-a-recipe flow (route /add): doorway (where did this come from?) → either
// PASTE or the form → a "saved" confirmation → an optional hand-off.
//
// There used to be a third screen between the doorway and the form, collecting the
// source's name/place/year/memory. Testers found the flow too effortful and one
// abandoned mid-way, so that screen is now folded into the top of the form itself
// (SourceFields) — one less page to get through, same fields.
//
// PASTING is offered as a second door rather than replacing the form, because a
// line-based parser can't handle dictated run-on prose and someone who hit that
// unasked would conclude the app is broken. See PasteRecipe + lib/parseRecipeText.
export default function PlantRecipe() {
  const navigate = useNavigate()
  const [step, setStep] = useState('doorway') // doorway|paste|form|saved|handoff
  // What a paste produced, mapped into RecipeForm's initialValues shape. Held here
  // rather than passed through navigation so a back-and-forth doesn't lose it.
  const [seeded, setSeeded] = useState(null)
  // The raw pasted text, kept so back-from-the-form returns to it intact.
  const [pastedText, setPastedText] = useState('')
  const [originMode, setOriginMode] = useState(null) // 'ancestor'|'mine'
  const [origin, setOrigin] = useState({
    name: '',
    place: '',
    year: '',
    memory: '',
  })
  // Private-by-default, matching the column default: sharing is a deliberate act,
  // never something the flow does on the user's behalf.
  const [visibility, setVisibility] = useState('private')
  const [saved, setSaved] = useState(null)
  // Whether the save that produced `saved` was name-only. Tracked explicitly rather
  // than inferred from the response, so the confirmation copy can't misread a full
  // save that simply came back without steps.
  const [nameOnly, setNameOnly] = useState(false)

  function chooseDoor(mode) {
    setOriginMode(mode)
    setStep('form')
  }

  // Step-aware back: doorway exits the flow (→ Home); paste and the form return to it.
  // The form goes back to PASTE when that's where its values came from, so correcting
  // the source text is possible without losing the parse.
  function goBack() {
    if (step === 'form') setStep(seeded ? 'paste' : 'doorway')
    else if (step === 'paste') setStep('doorway')
    else navigate('/')
  }

  // A parse lands on the ordinary form, pre-filled. Nothing is saved here — the
  // parser is allowed to be wrong, and the form is where that gets corrected.
  function handleParsed(parsed, sourceText) {
    setPastedText(sourceText)
    setSeeded({
      name: parsed.name,
      ingredients: parsed.ingredients.length
        ? parsed.ingredients.map((i) => ({ name: i.name, quantity: i.amount }))
        : undefined,
      steps: parsed.steps.length
        ? parsed.steps.map((content) => ({ content, voice_note: '', photo_url: '' }))
        : undefined,
      guessedLines: parsed.guessedLines,
      usedHeaders: parsed.usedHeaders,
    })
    setStep('form')
  }

  // Save with the dish name alone. Same endpoint and the same visibility choice as a
  // full save — this is a smaller recipe, not a different kind of thing. The origin is
  // still attached if the inherited door was chosen, because "Lola's" is worth keeping
  // even when nothing else is filled in yet.
  async function handleQuickSave(dishName) {
    const payload = { name: dishName, visibility }
    if (originMode === 'ancestor' && origin.name.trim()) {
      payload.origin = buildOriginPayload(origin)
    }
    const { data } = await plantRecipe(payload)
    setSaved(data)
    setNameOnly(true)
    setStep('saved')
  }

  async function handleFormSubmit(formPayload) {
    const payload = { ...formPayload, visibility }
    if (originMode === 'ancestor' && origin.name.trim()) {
      // Attribution only — the dish's story lives in payload.story from the form,
      // so there is a single story input rather than two that could disagree.
      payload.origin = buildOriginPayload(origin)
    }
    const { data } = await plantRecipe(payload)
    setSaved(data)
    setNameOnly(false)
    setStep('saved')
  }

  if (step === 'doorway') {
    return (
      <div className="min-h-screen bg-cream px-[18px] pt-5">
        <div className="mb-4">
          <BackButton to="/" label="Home" />
        </div>
        {/* eyebrow stamp — a small rotated "new recipe" badge for character */}
        <span className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[10.5px] text-ink bg-saffron border-2 border-ink rounded-full px-3 py-1 -rotate-2 shadow-[0_2px_0_#2E3A24]">
          ✦ New recipe
        </span>
        <h1 className="font-display font-black text-[30px] text-ink leading-tight mt-4">
          Where does this
          <br />
          recipe begin?
        </h1>
        <p className="font-display italic text-[15px] text-ink-soft mt-2 mb-6">
          Every recipe has a first hand that made it.
        </p>

        {/* Choice cards — each with a decorative emoji stamp badge. */}
        <button
          onClick={() => chooseDoor('ancestor')}
          className="flex w-full items-center gap-3.5 text-left sticker sticker-press bg-peach p-4 mb-4"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-full bg-cream border-2 border-ink shadow-[0_3px_0_#2E3A24] text-[24px] leading-none rotate-[-6deg]">
            👵
          </span>
          <span className="min-w-0">
            <span className="font-display font-black text-[18px] text-ink">
              Passed down to you
            </span>
            <span className="block font-display text-[13px] text-ink-soft mt-0.5">
              Someone taught you this. Honor them.
            </span>
          </span>
        </button>
        <button
          onClick={() => chooseDoor('mine')}
          className="flex w-full items-center gap-3.5 text-left sticker sticker-press bg-card p-4"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-full bg-sage border-2 border-ink shadow-[0_3px_0_#2E3A24] text-[24px] leading-none rotate-[6deg]">
            🧑‍🍳
          </span>
          <span className="min-w-0">
            <span className="font-display font-black text-[18px] text-ink">
              One of your own
            </span>
            <span className="block font-display text-[13px] text-ink-soft mt-0.5">
              You are where this one begins.
            </span>
          </span>
        </button>

        {/* THE SHORTCUT, offered rather than imposed — and offered SECOND, because
            the two doors above ask the question this app is actually about (whose
            dish is this?) and pasting doesn't answer it. Someone who already has the
            recipe as text can skip ~19 fields; everyone else never has to meet a
            parser. See PasteRecipe for why it can't be the default. */}
        <div className="flex items-center gap-3 my-5">
          <span className="h-[2px] flex-1 bg-line rounded-full" />
          <span className="font-display italic text-[13px] text-ink-soft">
            or, if it&rsquo;s already written down
          </span>
          <span className="h-[2px] flex-1 bg-line rounded-full" />
        </div>
        <button
          onClick={() => setStep('paste')}
          className="flex w-full items-center gap-3.5 text-left sticker sticker-press bg-cream p-4"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-[14px] bg-card border-2 border-ink shadow-[0_3px_0_#2E3A24] text-ink">
            <Icon name="list" className="w-6 h-6" />
          </span>
          <span className="min-w-0">
            <span className="font-display font-black text-[18px] text-ink">
              Paste the whole thing
            </span>
            <span className="block font-display text-[13px] text-ink-soft mt-0.5">
              From your notes, or just say it out loud.
            </span>
          </span>
        </button>
      </div>
    )
  }

  if (step === 'paste') {
    return (
      <PasteRecipe
        initialText={pastedText}
        onParsed={handleParsed}
        onBack={goBack}
      />
    )
  }

  if (step === 'form') {
    const inherited = originMode === 'ancestor'
    return (
      <div className="min-h-screen bg-cream">
        <RecipeForm
          mode="add"
          onSubmit={handleFormSubmit}
          onQuickSave={handleQuickSave}
          initialValues={seeded || {}}
          // Branch the story prompt: only the inherited path asks about the
          // person who taught you.
          storyVariant={inherited ? 'inherited' : 'own'}
          topSlot={
            <>
              <BackButton onClick={goBack} label="Back" />
              {inherited && (
                <div className="mt-4">
                  <SourceFields value={origin} onChange={setOrigin} />
                </div>
              )}
            </>
          }
          // Sits just above "Keep this recipe" — the last thing you decide before
          // saving, and no extra step in a flow testers already found effortful.
          beforeSubmitSlot={
            <VisibilityChoice value={visibility} onChange={setVisibility} />
          }
          intro={
            seeded ? (
              /* After a paste, the form's job changes from "fill this in" to "check
                 this". Saying HOW MANY lines were guessed — rather than a vague
                 "review your recipe" — tells someone where to actually look, and
                 admits the parser might be wrong instead of presenting its output as
                 fact. A paste that used the author's own Ingredients:/Instructions:
                 headers guessed nothing, so it says that instead. */
              <div className="sticker bg-peach px-4 py-3 -mt-1 mb-4">
                <p className="font-display font-bold text-[14px] text-ink leading-snug">
                  {seeded.usedHeaders
                    ? 'Sorted using your own headings.'
                    : `Sorted ${seeded.guessedLines} ${
                        seeded.guessedLines === 1 ? 'line' : 'lines'
                      } as best we could.`}
                </p>
                <p className="font-display italic text-[13px] text-ink-soft mt-1 leading-snug">
                  Fix anything that landed in the wrong place — nothing is saved yet.
                </p>
              </div>
            ) : (
              <p className="font-display italic text-[14px] text-ink-soft -mt-2 mb-4">
                Add what you&rsquo;ve got — &ldquo;a splash of vinegar&rdquo; is
                perfect. Only the dish name is required.
              </p>
            )
          }
        />
      </div>
    )
  }

  if (step === 'saved') {
    // The source's first name personalizes the "add their story" act; the
    // self-authored path has no source, so the act reads "add a memory".
    const sourceName =
      originMode === 'ancestor' && origin.name.trim()
        ? origin.name.trim().split(/\s+/)[0]
        : null
    const storyAct = sourceName ? `add ${sourceName}’s story` : 'add a memory'
    return (
      <div className="min-h-screen bg-cream px-[18px] pt-16 text-center flex flex-col items-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sage text-ink border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24]">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-8 h-8">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#2E3A24"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[11px] text-ink bg-saffron border-2 border-ink rounded-full px-3 py-1 mt-6 mb-3">
          Saved to your kitchen
        </p>
        <h1 className="font-display font-black italic text-[28px] text-ink leading-tight">
          {saved.name} is saved.
        </h1>
        {/* A name-only recipe has nothing to cook from yet, so "cook it" would be
            nonsense. Keyed off HOW it was saved rather than off the response's shape:
            a full-form save can legitimately come back without steps, and reading the
            response conflated the two (which broke a page test). */}
        <p className="font-display italic text-[15px] text-ink-soft mt-3 mb-8 max-w-[17rem]">
          {nameOnly
            ? 'Add the rest whenever you like — it’s waiting in your kitchen.'
            : `Cook it, ${storyAct}, or send it to someone.`}
        </p>
        <button className="btn-primary" onClick={() => setStep('handoff')}>
          Send it to someone →
        </button>
        <button
          className="mt-3 font-display italic text-ink-soft text-sm"
          onClick={() => navigate(`/recipes/${saved.id}`)}
        >
          {/* Was "Take me to it →" — testers couldn't tell what "it" was (the
              recipe? the kitchen? the send flow?). Naming the destination costs
              nothing. */}
          View {saved.name} →
        </button>
      </div>
    )
  }

  // step === 'handoff' — only reachable after a successful save, but guard
  // `saved` defensively to match the optional-chaining used elsewhere.
  if (!saved) return null
  return (
    <div className="min-h-screen bg-cream">
      <HandoffInvite
        recipeId={saved.id}
        recipeName={saved.name}
        sourceName={
          originMode === 'ancestor' && origin.name.trim()
            ? origin.name.trim()
            : null
        }
        onSent={() => navigate(`/recipes/${saved.id}`)}
        onSkip={() => navigate(`/recipes/${saved.id}`)}
      />
    </div>
  )
}
