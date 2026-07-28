import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import VisibilityControl from '../components/VisibilityControl'
import RecipeBody from '../components/RecipeBody'
import Icon from '../components/Icon'
import Loader from '../components/Loader'

// RecipePage — the classic recipe detail page (kitchen, not garden). Loads the
// recipe and renders a centered Fraunces title, the readable body (cover, byline,
// story, ingredients + steps via <RecipeBody>), and — for the owner — the
// visibility control and a "Pass it on" handoff button. No plant hero, no growth,
// no soul sheet: the recipe is a recipe.
export default function RecipePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get(`/recipes/${id}`)
      .then((res) => setRecipe(res.data))
      .catch(() => setError('Recipe not found'))
  }, [id])

  const currentUser = JSON.parse(localStorage.getItem('issei_user') || '{}')
  const isOwner = recipe && currentUser.id === recipe.user_id

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

  if (!recipe) {
    return <Loader />
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* HEADER — circular back button, owner edit affordance, centered title. */}
      <header className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2.5">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-ink bg-cream text-ink shadow-[0_3px_0_#2E3A24] active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
          >
            <Icon name="back" className="w-5 h-5" />
          </button>
          {isOwner && (
            <button
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
              aria-label="Edit recipe"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-ink bg-cream text-ink shadow-[0_3px_0_#2E3A24] active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
            >
              <Icon name="edit" className="w-5 h-5" />
            </button>
          )}
        </div>

        <h1 className="font-display font-black text-[34px] leading-[1.0] tracking-[-0.01em] text-ink text-center">
          {recipe.name}
        </h1>
      </header>

      {/* BODY — cover, byline, story, ingredients + steps (with cooking mode). */}
      <div className="px-5 pb-8">
        <RecipeBody recipe={recipe} />

        {/* OWNER SURFACES — who can see it, and passing it on to the next hand. */}
        {isOwner && (
          <div className="mt-8">
            <VisibilityControl
              recipe={recipe}
              onChange={(v) => setRecipe({ ...recipe, visibility: v })}
            />

            <button
              onClick={() => navigate(`/recipes/${recipe.id}/handoff`)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 font-display font-bold text-[15px] text-cream bg-terra rounded-full px-3.5 py-3 border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-[15px] h-[15px]">
                <path
                  d="M4 12l16-7-7 16-2.5-6.5L4 12Z"
                  stroke="#FBF3E2"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              Pass it on
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
