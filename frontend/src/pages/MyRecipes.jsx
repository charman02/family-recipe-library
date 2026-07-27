import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import RecipeCard from '../components/RecipeCard'
import IconField from '../components/IconField'

export default function MyRecipes() {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    client
      .get('/recipes')
      .then((res) => setRecipes(res.data))
      .catch(() => {})
  }, [])

  const query = search.trim()
  const searching = query.length > 0
  const filtered = searching
    ? recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : recipes

  return (
    <div className="min-h-screen bg-cream px-5 pt-6 pb-6">
      <h1 className="font-display font-black text-[32px] leading-none text-ink inline-block border-b-[3px] border-ink pb-1">
        Your kitchen<span className="text-terra">.</span>
      </h1>
      <p className="font-display italic text-[15px] text-ink-soft mt-2">
        Everything you&rsquo;ve kept.
      </p>

      <button
        onClick={() => navigate('/shared')}
        className="mt-3 inline-block font-display font-bold text-[12px] text-ink bg-mint border-2 border-ink rounded-full px-3 py-1 shadow-[0_2px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-none"
      >
        Shared with you →
      </button>

      <IconField
        icon="search"
        iconClassName="text-ink-soft"
        type="text"
        placeholder="Search recipes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        wrapperClassName="mt-4 mb-5"
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        {filtered.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            variant="grid"
            onClick={() => navigate(`/recipes/${recipe.id}`)}
          />
        ))}
      </div>

      {searching && filtered.length === 0 && (
        <p className="text-center font-display italic text-ink-soft text-[15px] mt-10">
          No recipes match “{query}”.
        </p>
      )}
      {!searching && recipes.length === 0 && (
        <p className="text-center font-display italic text-ink-soft text-[15px] mt-10">
          Your kitchen&rsquo;s empty — keep your first recipe.
        </p>
      )}
    </div>
  )
}
