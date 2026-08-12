import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { deleteRecipe } from '../api/sharing'
import VisibilityControl from '../components/VisibilityControl'
import RecipeBody from '../components/RecipeBody'
import Icon from '../components/Icon'
import Loader from '../components/Loader'

// RecipePage — the classic recipe detail page (kitchen, not garden). Loads the
// recipe and renders a centered Fraunces title, the readable body (cover, byline,
// story, ingredients + steps via <RecipeBody>), and — for the owner — the
// visibility control and a handoff button. No plant hero, no growth, no soul
// sheet: the recipe is a recipe.
//
// The handoff button used to read "Pass it on", which testers couldn't decode and
// several read as publishing. It now says what tapping it produces.
//
// It carried an italic sub-line ruling out the publish fear ("It doesn't change
// who else can see it"). Together with the visibility prose and the delete
// button, the bottom of the page turned into paragraphs with buttons embedded in
// them. The reassurance isn't lost: HandoffInvite — the very next screen, before
// any link exists — states it outright ("This doesn't put your recipe in
// Browse"), which is where it's actually load-bearing.
export default function RecipePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    client
      .get(`/recipes/${id}`)
      .then((res) => setRecipe(res.data))
      .catch(() => setError('Recipe not found'))
  }, [id])

  const currentUser = JSON.parse(localStorage.getItem('issei_user') || '{}')
  const isOwner = recipe && currentUser.id === recipe.user_id

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteRecipe(id)
      navigate('/my-recipes')
    } catch {
      setError('Could not delete this recipe. Please try again.')
      setDeleting(false)
      setConfirmDelete(false)
    }
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
        <RecipeBody recipe={recipe} scalable />

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
              Send this to someone
            </button>

            <button
              onClick={() => setConfirmDelete(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 font-display font-bold text-[14px] text-terra bg-cream rounded-full px-3.5 py-2.5 border-2 border-ink shadow-[0_3px_0_#2E3A24] active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-[15px] h-[15px]">
                <path
                  d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"
                  stroke="#B5502A"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Delete recipe
            </button>
          </div>
        )}
      </div>

      {/* DELETE CONFIRM — a sticker dialog; delete is permanent from the user's
          view (soft-deleted server-side, but there's no un-delete UI). */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-6">
          <div className="sticker bg-cream p-5 max-w-xs w-full text-center">
            <p className="font-display font-black text-ink text-[20px] leading-tight">
              Delete {recipe.name}?
            </p>
            <p className="font-display text-[13px] text-ink-soft mt-1.5 mb-4">
              This removes it from your kitchen. You can&rsquo;t undo this.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-full bg-cream border-2 border-ink text-ink font-display font-bold text-[14px] py-2.5 shadow-[0_3px_0_#2E3A24] active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] transition-transform disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-full bg-brick border-2 border-ink text-cream font-display font-bold text-[14px] py-2.5 shadow-[0_3px_0_#2E3A24] active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] transition-transform disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
