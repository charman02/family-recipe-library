import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm'
import PasteRecipe from '../components/PasteRecipe'
import HandoffInvite from '../components/HandoffInvite'
import SaveCelebration from '../components/SaveCelebration'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import VisibilityChoice from '../components/VisibilityChoice'
import { plantRecipe } from '../api/sharing'

// The add-a-recipe flow (route /add): choose a door (fill it in, or paste the
// whole thing) → the form → a "saved" confirmation → an optional hand-off.
//
// TWO doors only. The old flow forked on "passed down to you vs. one of your
// own", which decided whether the form even asked who the recipe came from.
// That question is now a single optional field on the form itself (RecipeForm's
// "Passed down from"), so the doorway no longer has to make the call — it just
// picks HOW you enter the recipe. Pasting stays a separate door because a parser
// can be confidently wrong, and someone who hit that unasked would think the app
// was broken. See PasteRecipe + lib/parseRecipeText.
export default function PlantRecipe() {
  const navigate = useNavigate()
  const [step, setStep] = useState('doorway') // doorway|paste|form|celebrate|saved|handoff
  // What a paste produced, mapped into RecipeForm's initialValues shape. Held here
  // rather than passed through navigation so a back-and-forth doesn't lose it.
  const [seeded, setSeeded] = useState(null)
  // The raw pasted text, kept so back-from-the-form returns to it intact.
  const [pastedText, setPastedText] = useState('')
  // Public-by-default: a new recipe shows up in Browse (and everyone's "Passed
  // down lately") unless the author opts it down to "Only me" in VisibilityChoice.
  // The default was flipped from private to seed the public feed; the choice is
  // still shown at save time, so opting out is one tap.
  const [visibility, setVisibility] = useState('public')
  const [saved, setSaved] = useState(null)
  // The source name captured on the saved recipe, passed to the hand-off so its
  // copy can address the person it came from. Read back from the form's payload.
  const [savedSource, setSavedSource] = useState('')

  // Step-aware back: doorway exits the flow (→ Home); paste and the form return to it.
  // The form goes back to PASTE when that's where its values came from, so correcting
  // the source text is possible without losing the parse.
  function goBack() {
    if (step === 'form') setStep(seeded ? 'paste' : 'doorway')
    else if (step === 'paste') setStep('doorway')
    else navigate('/')
  }

  // A parse lands on the ordinary form, pre-filled. Nothing is saved here — either
  // parser is allowed to be wrong, and the form is where that gets corrected.
  //
  // Handles both parsers' output. The local one returns steps as plain strings; the
  // model returns objects carrying a note ("don't crowd the pan"), which becomes the
  // step's voice_note — the field that exists precisely for the remark an ingredient
  // list can't hold. The model also picks out who the recipe came from, which now
  // seeds the form's own "Passed down from" field.
  function handleParsed(parsed, sourceText) {
    setPastedText(sourceText)
    setSeeded({
      name: parsed.name,
      description: parsed.description || undefined,
      cuisine: parsed.cuisine || undefined,
      servings: parsed.servings || undefined,
      sourceName: parsed.sourceName || '',
      ingredients: parsed.ingredients.length
        ? parsed.ingredients.map((i) => ({ name: i.name, quantity: i.amount }))
        : undefined,
      steps: parsed.steps.length
        ? parsed.steps.map((s) =>
            typeof s === 'string'
              ? { content: s, voice_note: '', photo_url: '' }
              : { content: s.content, voice_note: s.note || '', photo_url: '' },
          )
        : undefined,
      guessedLines: parsed.guessedLines,
      usedHeaders: parsed.usedHeaders,
      viaAI: Boolean(parsed.viaAI),
    })
    setStep('form')
  }

  // Save with the dish name alone. Same endpoint and the same visibility choice as a
  // full save — this is a smaller recipe, not a different kind of thing. No origin:
  // the name-only escape hatch is offered before the source field is filled.
  async function handleQuickSave(dishName) {
    const { data } = await plantRecipe({ name: dishName, visibility })
    setSaved(data)
    setSavedSource('')
    setStep('celebrate')
  }

  // The form builds its own payload, including the optional origin from its
  // "Passed down from" field. This handler just adds visibility and posts.
  async function handleFormSubmit(formPayload) {
    const { data } = await plantRecipe({ ...formPayload, visibility })
    setSaved(data)
    setSavedSource(formPayload.origin?.name || '')
    setStep('celebrate')
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
          Add a recipe
        </h1>
        <p className="font-display italic text-[15px] text-ink-soft mt-2 mb-6">
          Two ways in — whichever suits what you&rsquo;ve got.
        </p>

        {/* Door 1 — SAY IT / PASTE IT, the app's signature way in and now the top,
            visually-primary card. You don't have to be tidy: say it however it comes
            out (or paste your notes) and it's organized into a recipe for you. See
            PasteRecipe. Peach + a mic glyph so speaking reads as the headline action. */}
        <button
          onClick={() => setStep('paste')}
          className="flex w-full items-center gap-3.5 text-left sticker sticker-press bg-peach p-4 mb-4"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-full bg-cream border-2 border-ink shadow-[0_3px_0_#2E3A24] text-ink rotate-[-6deg]">
            <Icon name="mic" className="w-6 h-6" />
          </span>
          <span className="min-w-0">
            <span className="font-display font-black text-[18px] text-ink">
              Say it or paste it
            </span>
            <span className="block font-display text-[13px] text-ink-soft mt-0.5">
              Messy is fine — tell it how you make it and we&rsquo;ll sort it into a recipe.
            </span>
          </span>
        </button>

        {/* Door 2 — the plain form, for filling it in field by field. Demoted below
            the say/paste door but still a full card, not a link. */}
        <button
          onClick={() => {
            setSeeded(null)
            setStep('form')
          }}
          className="flex w-full items-center gap-3.5 text-left sticker sticker-press bg-card p-4"
        >
          <span className="flex-none flex items-center justify-center w-12 h-12 rounded-[14px] bg-sage border-2 border-ink shadow-[0_3px_0_#2E3A24] text-ink rotate-[6deg]">
            <Icon name="edit" className="w-6 h-6" />
          </span>
          <span className="min-w-0">
            <span className="font-display font-black text-[18px] text-ink">
              Fill it in yourself
            </span>
            <span className="block font-display text-[13px] text-ink-soft mt-0.5">
              One field at a time. Only the name is required.
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
    return (
      <div className="min-h-screen bg-cream">
        <RecipeForm
          mode="add"
          onSubmit={handleFormSubmit}
          onQuickSave={handleQuickSave}
          initialValues={seeded || {}}
          topSlot={<BackButton onClick={goBack} label="Back" />}
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
                  {seeded.viaAI
                    ? 'Sorted out what you said.'
                    : seeded.usedHeaders
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

  if (step === 'celebrate') {
    // The recipe is already saved (the handlers posted before setting this step),
    // so this is pure celebration over the top. Its reveal IS the terminal "saved"
    // screen: the cloud parts to show a checkmark, the recipe card (tap → view it),
    // and a share button. Reduced motion renders that reveal on the first frame, so
    // both actions are always one tap away. Guard `saved` defensively.
    if (!saved) return null
    return (
      <SaveCelebration
        recipe={saved}
        onView={() => navigate(`/recipes/${saved.id}`)}
        onShare={() => setStep('handoff')}
      />
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
        sourceName={savedSource.trim() || null}
        onSent={() => navigate(`/recipes/${saved.id}`)}
        onSkip={() => navigate(`/recipes/${saved.id}`)}
      />
    </div>
  )
}
