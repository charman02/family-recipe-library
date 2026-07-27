import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSharedWithMe } from '../api/lineage'
import RecipeCard from '../components/RecipeCard'

export default function SharedWithMe() {
  const [recipes, setRecipes] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getSharedWithMe()
      .then((res) => setRecipes(res.data))
      .catch(() => setRecipes([]))
  }, [])

  if (recipes === null)
    return (
      <div className="min-h-screen bg-cream p-6 text-center font-display italic text-ink-soft">
        Loading…
      </div>
    )

  return (
    <div className="min-h-screen bg-cream px-5 pt-6">
      <h1 className="font-display font-black text-[32px] text-ink leading-none inline-block border-b-[3px] border-ink pb-1">
        Shared with you<span className="text-terra">.</span>
      </h1>
      <p className="font-display italic text-[15px] text-ink-soft mt-2 mb-5">
        Recipes others have passed to you.
      </p>
      {recipes.length === 0 ? (
        <p className="text-center font-display italic text-ink-soft text-[15px] mt-10">
          Nothing&rsquo;s been shared with you yet.
        </p>
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
