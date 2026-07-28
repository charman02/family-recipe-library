import { useState } from 'react'
import client from '../api/client'
import Icon from './Icon'
import MarkerTitle from './MarkerTitle'
import { parseQuantity } from '../utils/quantity'

// Shared Add/Edit recipe form. Owns all field state, photo upload, ingredient/
// step management, client-side validation, and payload assembly. The parent
// (AddRecipe / EditRecipe) supplies initial values and an onSubmit that performs
// the actual POST/PATCH + navigation — this component just hands it a built
// payload and manages the surrounding loading/error UI.
//
// mode: 'add' | 'edit' — drives the heading and button labels.

const emptyIngredient = () => ({ name: '', quantity: '' })
const emptyStep = () => ({ content: '', voice_note: '' })

// Keep in sync with the backend's accepted formats in app/routers/upload.py.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

function hasAcceptedExtension(filename) {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
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

// A persistent field label — stays visible after the field is filled, so a
// value never loses its meaning (the placeholder-only problem). `accent` tints
// the label + a leading dot to mark the "secondary" field in a pair (the
// measurement beside an ingredient, the personal note beside a step).
function FieldLabel({ children, accent }) {
  const color = accent === 'plum' ? 'text-plum' : accent === 'terra' ? 'text-terra' : 'text-ink-soft'
  return (
    <span className={`flex items-center gap-1 font-display font-bold text-[10.5px] uppercase tracking-[0.1em] mb-1 ${color}`}>
      {accent && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${accent === 'plum' ? 'bg-plum' : 'bg-terra'}`}
        />
      )}
      {children}
    </span>
  )
}

export default function RecipeForm({
  mode = 'add',
  initialValues = {},
  onSubmit,
  submitLabel,
  beforeSubmitSlot = null,
  intro = null,
  topSlot = null,
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
  const [ingredients, setIngredients] = useState(
    initialValues.ingredients?.length
      ? initialValues.ingredients
      : [emptyIngredient()],
  )
  const [steps, setSteps] = useState(
    initialValues.steps?.length ? initialValues.steps : [emptyStep()],
  )
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(
    initialValues.coverPhotoUrl || '',
  )
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const heading = mode === 'edit' ? 'Edit recipe' : 'Keep a recipe'
  const defaultSubmitLabel =
    mode === 'edit' ? 'Save changes' : 'Keep this recipe'
  const submitText = submitLabel || defaultSubmitLabel
  const loadingLabel = mode === 'edit' ? 'Saving…' : 'Keeping…'

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')

    // Validate client-side first for instant feedback, matching the backend.
    // Check both MIME type and extension: some browsers report an empty or
    // unexpected file.type, so the extension is a reliable fallback.
    const typeOk = ACCEPTED_IMAGE_TYPES.includes(file.type)
    const extOk = hasAcceptedExtension(file.name)
    if (!typeOk && !extOk) {
      setPhotoError('Please choose a JPEG, PNG, or WebP image.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError('That image is too large (max 10 MB).')
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await client.post('/upload/recipe-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCoverPhotoUrl(data.url)
    } catch (err) {
      setPhotoError(
        err.response?.data?.detail || 'Photo upload failed. Please try again.',
      )
    } finally {
      setUploading(false)
      e.target.value = '' // reset so re-selecting the same file fires onChange
    }
  }

  function removePhoto() {
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
        err.response?.data?.detail || 'Something went wrong. Please try again.',
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
        {/* Cover photo */}
        {coverPhotoUrl ? (
          <div className="relative w-full h-[120px] rounded-xl overflow-hidden mb-1.5">
            <img
              src={coverPhotoUrl}
              alt="Recipe cover"
              className="w-full h-full object-cover"
            />
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
          <label className="flex flex-col items-center justify-center w-full h-[120px] rounded-xl border-2 border-dashed border-ink/45 bg-peach text-terra cursor-pointer mb-1.5">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {uploading ? (
              <span className="text-sm text-terra/70">Uploading…</span>
            ) : (
              <>
                <Icon name="camera" className="w-[30px] h-[30px] mb-1.5" />
                <span className="font-sans text-[13px]">
                  Add a photo to bring this recipe to life
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
          <p className="font-sans text-[11px] text-ink-soft mb-4">
            JPEG, PNG, or WebP · max 10 MB
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

        {/* The Story */}
        <FormSection>The story</FormSection>
        <label className="block">
          <FieldLabel accent="plum">In their words</FieldLabel>
          <p className="font-display italic text-[12px] text-ink-soft mb-1.5">
            Who taught you, when you make it, the memories it holds.
          </p>
          <textarea
            placeholder="My grandmother made this every Lunar New Year…"
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
            <div key={idx} className="sticker-sm bg-card p-3">
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
              <label className="block mb-2">
                <FieldLabel>Ingredient</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. soy sauce"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                  className="field"
                />
              </label>
              <label className="block">
                <FieldLabel accent="terra">How much</FieldLabel>
                <input
                  type="text"
                  placeholder="1/2 cup · a dash · to taste"
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(idx, 'quantity', e.target.value)
                  }
                  className="field bg-peach/50"
                />
              </label>
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

        {/* Steps — each row pairs the STEP itself with an optional "in their
            words" personal note, distinctly tinted + labeled. */}
        <FormSection>Steps</FormSection>
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
                  placeholder="Describe this step…"
                  value={step.content}
                  onChange={(e) => updateStep(idx, 'content', e.target.value)}
                  rows={2}
                  className="field resize-none"
                />
              </label>
              <label className="block">
                <FieldLabel accent="plum">Their words (optional)</FieldLabel>
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
