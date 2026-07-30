import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm'
import HandoffInvite from '../components/HandoffInvite'
import BackButton from '../components/BackButton'
import FieldLabel from '../components/FieldLabel'
import VisibilityChoice from '../components/VisibilityChoice'
import { buildOriginPayload } from '../lib/lineagePayload'
import { plantRecipe } from '../api/lineage'

// The add-a-recipe flow (route /add). A short heritage doorway (who this recipe
// came from) → capture → the recipe form → a "saved" confirmation → an optional
// hand-off. Kitchen look: cream, Fraunces, recipe-first — no plants, no growth.
export default function PlantRecipe() {
  const navigate = useNavigate()
  const [step, setStep] = useState('doorway') // doorway|origin|form|saved|handoff
  const [originMode, setOriginMode] = useState(null) // 'ancestor'|'mine'
  const [origin, setOrigin] = useState({
    name: '',
    place: '',
    year: '',
    memory: '',
  })
  const [selfMemory, setSelfMemory] = useState('')
  // Private-by-default, matching the column default: sharing is a deliberate act,
  // never something the flow does on the user's behalf.
  const [visibility, setVisibility] = useState('private')
  const [saved, setSaved] = useState(null)

  function chooseDoor(mode) {
    setOriginMode(mode)
    setStep('origin')
  }

  // Step-aware back: doorway exits the flow (→ Home); each later step returns to
  // the one before it.
  function goBack() {
    if (step === 'doorway') navigate('/')
    else if (step === 'origin') setStep('doorway')
    else if (step === 'form') setStep('origin')
    else navigate('/')
  }

  async function handleFormSubmit(formPayload) {
    const payload = { ...formPayload, visibility }
    if (originMode === 'ancestor') {
      // The doorway memory belongs to the SOURCE (origin.memory), which is
      // distinct from the dish's own story — leave payload.story from the form.
      payload.origin = buildOriginPayload(origin)
    }
    // On the 'mine' path the doorway memory seeds the form's Story field via
    // initialValues below, so formPayload.story is already authoritative — no
    // override here (that would silently discard edits made in the form).
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
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-full bg-mint border-2 border-ink shadow-[0_3px_0_#2E3A24] text-[24px] leading-none rotate-[6deg]">
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

  if (step === 'origin') {
    return (
      <div className="min-h-screen bg-cream px-[18px] pt-5">
        <div className="mb-4">
          <BackButton onClick={goBack} label="Back" />
        </div>
        {originMode === 'ancestor' ? (
          <>
            <span className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[10.5px] text-ink bg-plum text-cream border-2 border-ink rounded-full px-3 py-1 -rotate-2 shadow-[0_2px_0_#2E3A24]">
              💛 The source
            </span>
            <h1 className="font-display font-black text-[28px] text-ink leading-tight mt-4">
              Who taught you
              <br />
              this recipe?
            </h1>
            <p className="font-display italic text-[14px] text-ink-soft mt-2 mb-5">
              They&rsquo;ll be remembered as its source.
            </p>
            <label className="block mb-3">
              <FieldLabel>Their name</FieldLabel>
              <input
                className="field"
                placeholder="e.g. Lola Remedios"
                value={origin.name}
                onChange={(e) => setOrigin({ ...origin, name: e.target.value })}
              />
            </label>
            <div className="flex gap-2.5 mb-3">
              <label className="block flex-1">
                <FieldLabel>Place</FieldLabel>
                <input
                  className="field"
                  placeholder="Cebu"
                  value={origin.place}
                  onChange={(e) =>
                    setOrigin({ ...origin, place: e.target.value })
                  }
                />
              </label>
              <label className="block flex-1">
                <FieldLabel>Year</FieldLabel>
                <input
                  className="field"
                  placeholder="1974"
                  value={origin.year}
                  onChange={(e) => setOrigin({ ...origin, year: e.target.value })}
                />
              </label>
            </div>
            <label className="block mb-4">
              <FieldLabel accent="plum">A memory of them</FieldLabel>
              <textarea
                className="field resize-none"
                rows={3}
                placeholder="A memory of them & this dish (optional)"
                value={origin.memory}
                onChange={(e) => setOrigin({ ...origin, memory: e.target.value })}
              />
            </label>
            <button
              className="btn-primary disabled:opacity-50"
              disabled={!origin.name.trim()}
              onClick={() => setStep('form')}
            >
              Continue to the recipe →
            </button>
          </>
        ) : (
          <>
            <span className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[10.5px] text-ink bg-mint border-2 border-ink rounded-full px-3 py-1 -rotate-2 shadow-[0_2px_0_#2E3A24]">
              ✦ Your own
            </span>
            <h1 className="font-display font-black text-[28px] text-ink leading-tight mt-4">
              This one starts
              <br />
              with you.
            </h1>
            <p className="font-display italic text-[14px] text-ink-soft mt-2 mb-5">
              You&rsquo;re where this dish begins.
            </p>
            <label className="block mb-4">
              <FieldLabel accent="plum">What made this yours</FieldLabel>
              <textarea
                className="field resize-none"
                rows={4}
                placeholder="What made this yours? (optional)"
                value={selfMemory}
                onChange={(e) => setSelfMemory(e.target.value)}
              />
            </label>
            <button className="btn-primary" onClick={() => setStep('form')}>
              Continue to the recipe →
            </button>
          </>
        )}
      </div>
    )
  }

  if (step === 'form') {
    // Mine path: pre-fill the Story field with the doorway memory so there's
    // ONE story input. Ancestor path: no seed — the doorway memory is the
    // source's (captured in origin.memory), not the dish's story.
    const initialValues = originMode === 'mine' ? { story: selfMemory } : {}
    return (
      <div className="min-h-screen bg-cream">
        <RecipeForm
          mode="add"
          initialValues={initialValues}
          onSubmit={handleFormSubmit}
          topSlot={<BackButton onClick={goBack} label="Back" />}
          // Sits just above "Keep this recipe" — the last thing you decide before
          // saving, and no extra step in a flow testers already found effortful.
          beforeSubmitSlot={
            <VisibilityChoice value={visibility} onChange={setVisibility} />
          }
          intro={
            <p className="font-display italic text-[14px] text-ink-soft -mt-2 mb-4">
              Add what you&rsquo;ve got — &ldquo;a splash of vinegar&rdquo; is
              perfect. Only the name is required.
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
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mint text-ink border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24]">
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
          Cook it, {storyAct}, or pass it on.
        </p>
        <button className="btn-primary" onClick={() => setStep('handoff')}>
          Pass it on →
        </button>
        <button
          className="mt-3 font-display italic text-ink-soft text-sm"
          onClick={() => navigate(`/recipes/${saved.id}`)}
        >
          Take me to it →
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
