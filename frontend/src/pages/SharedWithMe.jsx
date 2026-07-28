import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSharedWithMe } from '../api/lineage'
import RecipeCard from '../components/RecipeCard'
import MarkerTitle from '../components/MarkerTitle'
import BackButton from '../components/BackButton'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'

export default function SharedWithMe() {
  const [recipes, setRecipes] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getSharedWithMe()
      .then((res) => setRecipes(res.data))
      .catch(() => setRecipes([]))
  }, [])

  if (recipes === null) return <Loader />

  return (
    <div className="min-h-screen bg-cream px-5 pt-5">
      <div className="mb-5">
        <BackButton to="/my-recipes" label="Back" />
      </div>
      <MarkerTitle
        color="bg-mint"
        className="font-display font-black text-[32px] text-ink leading-none"
      >
        Shared with you<span className="text-terra">.</span>
      </MarkerTitle>
      <p className="font-display italic text-[15px] text-ink-soft mt-2 mb-5">
        Recipes others have passed to you.
      </p>
      {recipes.length === 0 ? (
        <EmptyState
          icon="💌"
          badge="bg-mint"
          title="Nothing shared yet"
          sub="When someone passes you a recipe, it lands here."
          className="mt-6"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              variant="grid"
              onClick={() => navigate(`/recipes/${r.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
