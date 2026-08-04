import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm'
import HandoffInvite from '../components/HandoffInvite'
import BackButton from '../components/BackButton'
import VisibilityChoice from '../components/VisibilityChoice'
import SourceFields from '../components/SourceFields'
import { buildOriginPayload } from '../lib/originPayload'
import { plantRecipe } from '../api/sharing'

// The add-a-recipe flow (route /add): doorway (where did this come from?) → the
// recipe form → a "saved" confirmation → an optional hand-off.
//
// There used to be a third screen between the doorway and the form, collecting the
// source's name/place/year/memory. Testers found the flow too effortful and one
// abandoned mid-way, so that screen is now folded into the top of the form itself
// (SourceFields) — one less page to get through, same fields.
export default function PlantRecipe() {
  const navigate = useNavigate()
  const [step, setStep] = useState('doorway') // doorway|form|saved|handoff
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

  function chooseDoor(mode) {
    setOriginMode(mode)
    setStep('form')
  }

  // Step-aware back: doorway exits the flow (→ Home); the form returns to it.
  function goBack() {
    if (step === 'form') setStep('doorway')
    else navigate('/')
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
      </div>
    )
  }

  if (step === 'form') {
    const inherited = originMode === 'ancestor'
    return (
      <div className="min-h-screen bg-cream">
        <RecipeForm
          mode="add"
          onSubmit={handleFormSubmit}
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
            <p className="font-display italic text-[14px] text-ink-soft -mt-2 mb-4">
              Add what you&rsquo;ve got — &ldquo;a splash of vinegar&rdquo; is
              perfect. Only the dish name is required.
            </p>
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
        <p className="font-display italic text-[15px] text-ink-soft mt-3 mb-8 max-w-[17rem]">
          Cook it, {storyAct}, or send it to someone.
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
