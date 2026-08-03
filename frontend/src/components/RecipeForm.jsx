import { useEffect, useRef, useState } from 'react'
import client, { toUserMessage } from '../api/client'
import Icon from './Icon'
import MarkerTitle from './MarkerTitle'
import FieldLabel from './FieldLabel'
import IngredientNameField from './IngredientNameField'
import AmountUnitChips from './AmountUnitChips'
import { parseQuantity } from '../utils/quantity'
import { mergeSuggestions } from '../lib/commonIngredients'
import { shouldOfferUnits } from '../lib/amountChips'

// Shared Add/Edit recipe form. Owns all field state, photo upload, ingredient/
// step management, client-side validation, and payload assembly. The parent
// (AddRecipe / EditRecipe) supplies initial values and an onSubmit that performs
// the actual POST/PATCH + navigation — this component just hands it a built
// payload and manages the surrounding loading/error UI.
//
// mode: 'add' | 'edit' — drives the heading and button labels.

const emptyIngredient = () => ({ name: '', quantity: '' })
const emptyStep = () => ({ content: '', voice_note: '' })

// How many empty rows a NEW recipe starts with. More than one because a single
// empty box gave no visual cue that entries were meant to be separate — a tester
// typed their whole method into step 1 and every ingredient into ingredient 1.
// Seeing the shape of the list before typing is what prevents that; blank rows
// are filtered out on submit, so extras cost nothing.
const STARTING_INGREDIENTS = 3
const STARTING_STEPS = 3

const emptyRows = (make, n) => Array.from({ length: n }, make)

// Keep in sync with the backend's accepted formats in app/routers/upload.py.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

function hasAcceptedExtension(filename) {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// iPhones shoot HEIC/HEIF by default, which the backend rejects. Detect it by
// extension or MIME (browsers often report an empty type for HEIC).
function isHeic(file) {
  const t = (file.type || '').toLowerCase()
  const n = (file.name || '').toLowerCase()
  return (
    t === 'image/heic' ||
    t === 'image/heif' ||
    n.endsWith('.heic') ||
    n.endsWith('.heif')
  )
}

// A section heading for the form — a chunky Fraunces title with a highlighter
// swipe, so the form reads as playful sections rather than a flat field list.
function FormSection({ children }) {
  return (
    <div className="mt-7 mb-3">
      <MarkerTitle
        as="h2"
        color="bg-saffron"
        className="font-display font-black text-[22px] text-ink leading-none"
      >
        {children}
      </MarkerTitle>
    </div>
  )
}

// The story prompt changes with where the recipe came from. Asking "who taught
// you?" of someone who invented the dish is a small thing that makes the app feel
// like it isn't listening — testers noticed.
const STORY_COPY = {
  inherited: {
    label: 'Their story',
    help: 'Who taught you, when they made it, what you remember.',
    placeholder: 'My grandmother made this every Lunar New Year…',
  },
  own: {
    label: 'What makes it yours',
    help: 'How you came to it, when you make it, who you make it for.',
    placeholder: 'I started making this the winter I moved out…',
  },
}

export default function RecipeForm({
  mode = 'add',
  initialValues = {},
  onSubmit,
  submitLabel,
  beforeSubmitSlot = null,
  intro = null,
  topSlot = null,
  // 'inherited' — someone taught them this. 'own' — the recipe starts with them.
  storyVariant = 'inherited',
}) {
  const [name, setName] = useState(initialValues.name || '')
  const [servings, setServings] = useState(
    initialValues.servings != null ? String(initialValues.servings) : '',
  )
  const [cuisine, setCuisine] = useState(initialValues.cuisine || '')
  const [description, setDescription] = useState(
    initialValues.description || '',
  )
  const [story, setStory] = useState(initialValues.story || '')
  // Editing shows exactly what's saved; adding pre-seeds blank rows so the
  // list's shape is visible before typing (see STARTING_* above).
  const [ingredients, setIngredients] = useState(
    initialValues.ingredients?.length
      ? initialValues.ingredients
      : emptyRows(emptyIngredient, mode === 'add' ? STARTING_INGREDIENTS : 1),
  )
  const [steps, setSteps] = useState(
    initialValues.steps?.length
      ? initialValues.steps
      : emptyRows(emptyStep, mode === 'add' ? STARTING_STEPS : 1),
  )
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(
    initialValues.coverPhotoUrl || '',
  )
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Cover-photo upload concurrency. The picker stays enabled during an upload
  // on purpose — on a slow phone connection a disabled input that sits there
  // "Uploading…" for 30s is indistinguishable from a hung app, and the user's
  // instinct (pick again) has to keep working. So instead of locking the input
  // we make a second pick unambiguously win:
  //   • uploadSeq — every pick claims a ticket; only the newest ticket may write
  //     state. Without it whichever response lands LAST wins, which on a flaky
  //     link is often the FIRST photo, so replacing A with B silently kept A.
  //   • abortRef — cancel the superseded request so it stops competing for the
  //     phone's uplink, making the photo the user actually wants arrive sooner.
  // The seq guard is what makes correctness not depend on the abort landing in
  // time: a response already in flight when we abort is still ignored.
  const uploadSeq = useRef(0)
  const abortRef = useRef(null)

  // Ingredient autosuggest source. Starts as the shipped common list so the very
  // first keystroke suggests something, then folds in the words this user has
  // written before once they arrive. A failed or slow fetch is not an error the
  // user should ever see — the common list alone is a working feature, and the
  // one thing a suggestion must never do is get in the way of typing.
  const [suggestions, setSuggestions] = useState(() => mergeSuggestions([]))
  useEffect(() => {
    let live = true
    client
      .get('/recipes/ingredient-suggestions')
      .then(({ data }) => {
        if (live) setSuggestions(mergeSuggestions(data?.names || []))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const storyCopy = STORY_COPY[storyVariant] || STORY_COPY.inherited
  const heading = mode === 'edit' ? 'Edit recipe' : 'Keep a recipe'
  const defaultSubmitLabel =
    mode === 'edit' ? 'Save changes' : 'Keep this recipe'
  const submitText = submitLabel || defaultSubmitLabel
  const loadingLabel = mode === 'edit' ? 'Saving…' : 'Keeping…'

  async function handlePhotoSelect(e) {
    let file = e.target.files?.[0]
    if (!file) return
    const input = e.target

    const seq = ++uploadSeq.current
    // Any pick supersedes the one before it, so drop the older request.
    abortRef.current?.abort()
    const controller =
      typeof AbortController === 'function' ? new AbortController() : null
    abortRef.current = controller
    // Superseded picks must not touch state (that's the race) — and must not
    // clear `uploading`/reset the input either, or the newer upload's spinner
    // would vanish while it's still running.
    const isCurrent = () => uploadSeq.current === seq

    // A rejected pick only reports itself if it's still the current one.
    function reject(message) {
      if (!isCurrent()) return
      setPhotoError(message)
      setUploading(false)
      input.value = ''
    }

    setPhotoError('')
    setUploading(true)

    try {
      // iPhone HEIC → convert to JPEG in the browser so the upload just works.
      if (isHeic(file)) {
        try {
          const { default: heic2any } = await import('heic2any')
          const blob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9,
          })
          const out = Array.isArray(blob) ? blob[0] : blob
          file = new File(
            [out],
            file.name.replace(/\.hei[cf]$/i, '.jpg'),
            { type: 'image/jpeg' },
          )
        } catch {
          reject("Couldn't read that iPhone photo. Try again, or pick a JPEG.")
          return
        }
      }

      // Validate (post-conversion) for instant feedback, matching the backend.
      // Check both MIME type and extension: some browsers report an empty or
      // unexpected file.type, so the extension is a reliable fallback.
      const typeOk = ACCEPTED_IMAGE_TYPES.includes(file.type)
      const extOk = hasAcceptedExtension(file.name)
      if (!typeOk && !extOk) {
        reject('Please choose a JPEG, PNG, or WebP image.')
        return
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        reject('That image is too large (max 10 MB).')
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      const { data } = await client.post('/upload/recipe-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller?.signal,
      })
      if (!isCurrent()) return // a newer pick owns the cover now
      setCoverPhotoUrl(data.url)
    } catch (err) {
      // Includes the abort of a superseded request, which isn't a user-facing
      // failure — isCurrent() filters it out along with any other stale error.
      if (!isCurrent()) return
      setPhotoError(
        toUserMessage(err, 'Photo upload failed. Please try again.'),
      )
    } finally {
      if (isCurrent()) {
        setUploading(false)
        input.value = '' // reset so re-selecting the same file fires onChange
      }
    }
  }

  function removePhoto() {
    // Local-state only: the uploaded Cloudinary asset is deliberately left in
    // place. Deleting here would be wrong, not just incomplete — on the edit
    // form this URL belongs to the *saved* recipe, so removing and then
    // abandoning the form would leave the still-saved recipe pointing at a
    // deleted image. Orphan cleanup has to be server-side and reference-aware;
    // see the note in app/routers/upload.py.
    // Retiring the ticket is defensive: today the remove button and the picker
    // never render at once, so no upload can be in flight here. If that ever
    // changes (e.g. previewing the new photo while it uploads) a landing
    // response would silently re-fill the cover the user just cleared.
    uploadSeq.current++
    abortRef.current?.abort()
    setCoverPhotoUrl('')
    setPhotoError('')
  }

  function updateIngredient(index, field, value) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    )
  }

  function removeIngredient(index) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index, field, value) {
    // Spread to preserve any non-edited fields (e.g. section_header on edit).
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    )
  }

  function removeStep(index) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Enter advances to the next row instead of doing nothing (in a textarea it
  // would insert a newline, and on a phone the keyboard's "return" key is right
  // there). Adding a row when you're on the last one means a whole list can be
  // entered without ever reaching for "+ Add" — testers found the tapping, not
  // the typing, to be the tiring part.
  //
  // Shift+Enter still inserts a real newline, since a step legitimately runs long.
  // Open row index+1 for editing, adding it first if we're on the last one.
  // Extracted from advanceOnEnter so the ingredient CONFIRM button lands in
  // exactly the same place Enter does — two affordances, one behaviour, and no
  // second copy of the keyboard-preserving focus dance to keep in step.
  function openNextRow({ container, index, addRow, selector }) {
    const focusNext = () => {
      const fields = document.querySelectorAll(selector)
      fields[index + 1]?.focus()
    }
    if (index === container.length - 1) {
      addRow()
      // The new row doesn't exist until React commits, so wait a tick. On a phone
      // this also keeps the keyboard up — focusing an existing element in the same
      // gesture is what stops iOS from dismissing it.
      setTimeout(focusNext, 0)
    } else {
      focusNext()
    }
  }

  function advanceOnEnter(e, opts) {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    openNextRow(opts)
  }

  // The inline confirm: bank this ingredient and land in a fresh one. Same
  // destination as Enter on the amount field, reachable by thumb — testers who
  // never found the keyboard's return key were tapping "+ Add ingredient" and
  // then tapping into the new row, which is the three-taps-per-line the flow was
  // losing people to.
  function confirmIngredient(index) {
    openNextRow({
      container: ingredients,
      index,
      addRow: () => setIngredients((prev) => [...prev, emptyIngredient()]),
      selector: '[data-ingredient-name]',
    })
  }

  function focusIngredientField(index, selector) {
    document.querySelectorAll(selector)[index]?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = {
      name,
      cover_photo_url: coverPhotoUrl || null,
      servings: servings ? parseInt(servings) : null,
      cuisine: cuisine || null,
      description: description || null,
      story: story || null,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing, idx) => {
          const parsed = parseQuantity(ing.quantity)
          return {
            name: ing.name.trim(),
            quantity_text: parsed.quantity_text,
            quantity_value: parsed.quantity_value,
            unit: parsed.unit,
            quantity_type: parsed.quantity_type,
            position: idx + 1,
          }
        }),
      steps: steps
        .filter((s) => s.content.trim())
        .map((s, idx) => ({
          content: s.content.trim(),
          voice_note: s.voice_note?.trim() || null,
          section_header: s.section_header ?? null,
          position: idx + 1,
        })),
    }

    try {
      await onSubmit(payload)
      // On success the parent navigates away and this unmounts — don't touch state.
    } catch (err) {
      setError(
        toUserMessage(err, 'Something went wrong. Please try again.'),
      )
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream px-[18px] pt-5 pb-8">
      {topSlot && <div className="mb-4">{topSlot}</div>}
      <h1 className="font-display font-black text-[30px] text-ink mb-4">
        {heading}
      </h1>

      {intro}

      {error && (
        <p className="mb-4">
          <span className="error-pill">{error}</span>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Cover photo — a sticker photo target, matching the frame RecipeCard
            and RecipeBody put around a real cover: ink outline, hard offset
            shadow, and the same 150px photo height so the empty box previews
            the space the picture will occupy. The old dashed-outline dropzone
            was the one surface still speaking the pre-redesign language. */}
        {coverPhotoUrl ? (
          <div className="relative sticker overflow-hidden bg-card w-full h-[150px] mb-1.5">
            <img
              src={coverPhotoUrl}
              alt="Recipe cover"
              className="w-full h-full object-cover block"
            />
            {/* Corner stamp — same saffron tag RecipeCard pins on a cover, so a
                chosen photo reads as finished rather than as a raw preview. */}
            <span className="absolute top-2 left-2 font-display font-bold uppercase tracking-[0.06em] text-[9.5px] text-ink bg-saffron border-2 border-ink px-2 py-0.5 rounded-full">
              Cover photo
            </span>
            <button
              type="button"
              onClick={removePhoto}
              aria-label="Remove photo"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink flex items-center justify-center shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            aria-busy={uploading || undefined}
            className={`relative sticker sticker-press flex flex-col items-center justify-center w-full h-[150px] mb-1.5 cursor-pointer focus-within:ring-4 focus-within:ring-terra/25 ${
              // A failed pick tints the target itself, so the retry is obvious
              // at the thing you tap — not only in the pill below it.
              photoError ? 'bg-coral/20' : 'bg-peach'
            }`}
          >
            {/* sr-only, NOT `hidden`: display:none drops the input out of the tab
                order, which made the whole photo step keyboard-unreachable.
                Clipping keeps it focusable, and focus-within rings the box the
                user can actually see. aria-label keeps the accessible name
                stable while the visible copy swaps between states. */}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={handlePhotoSelect}
              aria-label="Add a cover photo"
              className="sr-only"
            />
            {uploading ? (
              // Bobbing saffron badge — the same waiting signal as <Loader>.
              <>
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-saffron border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] text-ink animate-bounce">
                  <Icon name="camera" className="w-7 h-7" />
                </span>
                <span className="font-display font-black text-[16px] text-ink mt-3 leading-none">
                  Uploading…
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-cream border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] text-ink -rotate-[6deg]">
                  <Icon name="camera" className="w-7 h-7" />
                </span>
                <span className="font-display font-black text-[17px] text-ink mt-3 leading-none">
                  Add a photo
                </span>
                <span className="font-display italic text-[12.5px] text-ink-soft mt-1.5">
                  It brings the dish to life
                </span>
              </>
            )}
          </label>
        )}
        {photoError ? (
          <p className="mb-4">
            <span className="error-pill">{photoError}</span>
          </p>
        ) : (
          <p className="font-display italic text-[12px] text-ink-soft mb-4">
            JPEG, PNG, WebP, or iPhone (HEIC) · max 10 MB
          </p>
        )}

        {/* Recipe details */}
        <FormSection>The dish</FormSection>
        <div className="space-y-3">
          {/* dish-led naming: the person is captured separately as the origin */}
          <label className="block">
            <FieldLabel>Dish name</FieldLabel>
            <input
              type="text"
              placeholder="e.g. “Adobo”"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field"
            />
            <p className="font-display italic text-[12px] text-ink-soft mt-1">
              You’ll say whose recipe it is next.
            </p>
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <FieldLabel>Servings</FieldLabel>
              <input
                type="number"
                placeholder="4"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="field"
              />
            </label>
            <label className="block flex-1">
              <FieldLabel>Cuisine</FieldLabel>
              <input
                type="text"
                placeholder="Filipino"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="field"
              />
            </label>
          </div>
          <label className="block">
            <FieldLabel>Description</FieldLabel>
            <textarea
              placeholder="What is this dish?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="field resize-none"
            />
          </label>
        </div>

        {/* The story — optional, and prompted differently depending on whether
            the recipe was inherited or invented (see STORY_COPY). Marked optional
            explicitly: testers treated an unlabeled textarea as required and
            stalled on it, which is the worst place to lose someone. */}
        <FormSection>The story</FormSection>
        <label className="block">
          <FieldLabel accent="plum">{storyCopy.label} (optional)</FieldLabel>
          <p className="font-display italic text-[12px] text-ink-soft mb-1.5">
            {storyCopy.help}
          </p>
          <textarea
            placeholder={storyCopy.placeholder}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={3}
            className="field resize-none"
          />
        </label>

        {/* Ingredients — each row pairs a bold NAME field with a tinted
            MEASUREMENT field, each with a persistent label so the two are never
            confused. */}
        <FormSection>Ingredients</FormSection>
        <p className="font-display italic text-[12px] text-ink-soft mb-3">
          Write amounts naturally — “1 1/2 cups”, “a good splash”, “to taste”.
        </p>
        <div className="space-y-3">
          {ingredients.map((ing, idx) => (
            <div key={idx} data-ingredient-row className="sticker-sm bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-black text-[13px] text-ink">
                  #{idx + 1}
                </span>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    aria-label={`Remove ingredient ${idx + 1}`}
                    className="text-ink-soft/70 hover:text-red-500"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Not a <label> wrapper: the name field is a combobox owning a
                  listbox, and a label around both would put the suggestions
                  inside the field's own accessible name. */}
              <div className="block mb-2">
                <FieldLabel>
                  <label htmlFor={`ingredient-name-${idx}`}>Ingredient</label>
                </FieldLabel>
                <IngredientNameField
                  id={`ingredient-name-${idx}`}
                  index={idx}
                  value={ing.name}
                  suggestions={suggestions}
                  placeholder="e.g. soy sauce"
                  onChange={(v) => updateIngredient(idx, 'name', v)}
                  // Within a row, name → amount rather than skipping to the
                  // next ingredient.
                  onAdvance={() =>
                    focusIngredientField(idx, '[data-ingredient-qty]')
                  }
                />
              </div>
              <label className="block">
                <FieldLabel accent="terra">How much</FieldLabel>
                <input
                  type="text"
                  data-ingredient-qty
                  placeholder="1/2 cup · a dash · to taste"
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(idx, 'quantity', e.target.value)
                  }
                  onKeyDown={(e) =>
                    advanceOnEnter(e, {
                      container: ingredients,
                      index: idx,
                      addRow: () =>
                        setIngredients((prev) => [...prev, emptyIngredient()]),
                      selector: '[data-ingredient-name]',
                    })
                  }
                  className="field bg-peach/50"
                />
              </label>
              {/* Units appear only over a bare number, so the strip is answering
                  a question the user has visibly just asked. */}
              {shouldOfferUnits(ing.quantity) && (
                <AmountUnitChips
                  index={idx}
                  value={ing.quantity}
                  onPick={(v) => updateIngredient(idx, 'quantity', v)}
                  onDone={() =>
                    focusIngredientField(idx, '[data-ingredient-qty]')
                  }
                />
              )}
              {/* Confirm only once there's something to confirm — an empty row
                  offering to save itself is a button that lies. */}
              {ing.name.trim() && (
                <button
                  type="button"
                  data-ingredient-confirm
                  onClick={() => confirmIngredient(idx)}
                  className="mt-2.5 inline-flex items-center gap-1.5 font-display font-bold text-[12.5px] text-terra"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  Done — next ingredient
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
          className="mt-3 font-display font-bold text-[13px] text-terra"
        >
          + Add ingredient
        </button>

        {/* Steps — each row pairs the STEP itself with an optional personal
            remark, distinctly tinted + labeled.

            A tester wrote their ENTIRE method into step 1, because with only one
            empty step rendered there was nothing on screen suggesting steps were
            meant to be separate. The fix is structural, not a hint: the add flow
            starts with several empty steps (see STARTING_STEPS) so the pattern is
            visible before you type, and pressing Enter in a step opens the next
            one. The line below states the intent for anyone who still wonders. */}
        <FormSection>Steps</FormSection>
        <p className="font-display italic text-[12px] text-ink-soft mb-3">
          One step per box — press Enter to start the next one.
        </p>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="sticker-sm bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display font-black text-[13px] text-ink">
                  Step {idx + 1}
                </span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    aria-label={`Remove step ${idx + 1}`}
                    className="text-ink-soft/70 hover:text-red-500"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                )}
              </div>
              <label className="block mb-2">
                <FieldLabel>What to do</FieldLabel>
                <textarea
                  data-step-content
                  placeholder="Describe this step…"
                  value={step.content}
                  onChange={(e) => updateStep(idx, 'content', e.target.value)}
                  onKeyDown={(e) =>
                    advanceOnEnter(e, {
                      container: steps,
                      index: idx,
                      addRow: () => setSteps((prev) => [...prev, emptyStep()]),
                      selector: '[data-step-content]',
                    })
                  }
                  rows={2}
                  className="field resize-none"
                />
              </label>
              <label className="block">
                <FieldLabel accent="plum">A note on this step (optional)</FieldLabel>
                <input
                  type="text"
                  placeholder={'“don\'t rush the onions”'}
                  value={step.voice_note || ''}
                  onChange={(e) => updateStep(idx, 'voice_note', e.target.value)}
                  className="field bg-plum/[0.06]"
                />
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSteps((prev) => [...prev, emptyStep()])}
          className="mt-3 font-display font-bold text-[13px] text-terra"
        >
          + Add step
        </button>

        {beforeSubmitSlot}
        <button type="submit" disabled={loading} className="btn-primary mt-5">
          {loading ? loadingLabel : submitText}
        </button>
      </form>
    </div>
  )
}
