import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm'
import PasteRecipe from '../components/PasteRecipe'
import HandoffInvite from '../components/HandoffInvite'
import SaveCelebration from '../components/SaveCelebration'
import BackButton from '../components/BackButton'
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
  // No doorway step any more: /add already chose "Keep a recipe", so we land straight
  // on the say/paste screen (the one signature way in). The old blank-form door lives
  // on as a "Rather type it in?" link at the bottom of that screen.
  const [step, setStep] = useState('paste') // paste|form|celebrate|saved|handoff
  // What a paste produced, mapped into RecipeForm's initialValues shape. Held here
  // rather than passed through navigation so a back-and-forth doesn't lose it.
  const [seeded, setSeeded] = useState(null)
  // The raw pasted text, kept so back-from-the-form returns to it intact.
  const [pastedText, setPastedText] = useState('')
  // Concrete visibility (#68). The default the form auto-selects mirrors the author's
  // profile — "Everyone" on a public profile, "Friends only" on a private one — but the
  // chosen value is stored literally, not as a live pointer to the profile. The user can
  // pick any of the three in VisibilityChoice, always shown at save time.
  const profileVisibility =
    JSON.parse(localStorage.getItem('issei_user') || '{}').profile_visibility ||
    'private'
  const [visibility, setVisibility] = useState(
    profileVisibility === 'public' ? 'public' : 'friends',
  )
  const [saved, setSaved] = useState(null)

  // Step-aware back. The say/paste screen is now the entry point, so its back exits to
  // the /add chooser. The form goes back to PASTE when a parse seeded it (so correcting
  // the source text is possible without losing the parse); a blank form reached via
  // "Rather type it in?" goes back to the paste screen too.
  function goBack() {
    if (step === 'form') setStep('paste')
    else navigate('/add')
  }

  // "Rather type it in?" — the demoted blank-form door, offered at the bottom of the
  // say/paste screen for someone with nothing to paste (the paste word-gate would
  // otherwise strand them).
  function typeItIn() {
    setSeeded(null)
    setStep('form')
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
    setStep('celebrate')
  }

  // The form builds its own payload, including the optional origin from its
  // "Passed down from" field. This handler just adds visibility and posts.
  async function handleFormSubmit(formPayload) {
    const { data } = await plantRecipe({ ...formPayload, visibility })
    setSaved(data)
    setStep('celebrate')
  }

  if (step === 'paste') {
    return (
      <PasteRecipe
        initialText={pastedText}
        onParsed={handleParsed}
        onBack={goBack}
        onTypeItIn={typeItIn}
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
        onSent={() => navigate(`/recipes/${saved.id}`)}
        onSkip={() => navigate(`/recipes/${saved.id}`)}
      />
    </div>
  )
}
