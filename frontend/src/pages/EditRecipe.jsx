import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import RecipeForm from '../components/RecipeForm'
import BackButton from '../components/BackButton'
import Loader from '../components/Loader'

// Loads an existing recipe, maps it to RecipeForm's initial-value shape, and
// PATCHes on save. Editing is owner-only: the backend PATCH already scopes to
// the current user (404 otherwise), and we redirect non-owners client-side so
// they never see the form.
export default function EditRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [initialValues, setInitialValues] = useState(null)
  const [error, setError] = useState('')
  const currentUser = JSON.parse(localStorage.getItem('issei_user') || '{}')

  useEffect(() => {
    client
      .get(`/recipes/${id}`)
      .then((res) => {
        const recipe = res.data
        if (currentUser.id !== recipe.user_id) {
          navigate(`/recipes/${id}`, { replace: true })
          return
        }

        // Merge direct-FK + sectioned ingredients into flat rows ordered by
        // position. The form takes a single free-text quantity per row, so we
        // surface the stored quantity_text verbatim (what the user typed).
        const flatIngredients = [
          ...recipe.ingredients,
          ...recipe.ingredient_sections.flatMap((s) => s.ingredients),
        ]
          .sort((a, b) => a.position - b.position)
          .map((ing) => ({ name: ing.name, quantity: ing.quantity_text || '' }))

        // Carry section_header AND voice_note through the round-trip: the PATCH
        // replaces all steps, so dropping either here would null a persisted
        // field on save (voice_note = the person's words for that step).
        const flatSteps = [...recipe.steps]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            content: s.content,
            section_header: s.section_header ?? null,
            voice_note: s.voice_note ?? '',
          }))

        setInitialValues({
          name: recipe.name,
          servings: recipe.servings,
          cuisine: recipe.cuisine,
          description: recipe.description,
          story: recipe.story,
          coverPhotoUrl: recipe.cover_photo_url || '',
          ingredients: flatIngredients,
          steps: flatSteps,
        })
      })
      .catch(() => setError('Recipe not found'))
  }, [id])

  async function handleSave(payload) {
    await client.patch(`/recipes/${id}`, payload)
    // Return to the recipe we came from (pop), so history stays clean and the
    // detail page remounts + refetches the updated recipe.
    navigate(-1)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="error-pill">{error}</span>
        <button
          onClick={() => navigate('/my-recipes')}
          className="font-display font-bold text-[13px] text-terra"
        >
          Back to your kitchen →
        </button>
      </div>
    )
  }

  if (!initialValues) {
    return <Loader />
  }

  return (
    <RecipeForm
      mode="edit"
      initialValues={initialValues}
      onSubmit={handleSave}
      topSlot={<BackButton label="Back" />}
    />
  )
}
