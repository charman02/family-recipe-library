import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { getSharedWithMe } from '../api/sharing'
import RecipeCard from '../components/RecipeCard'
import IconField from '../components/IconField'
import MarkerTitle from '../components/MarkerTitle'
import EmptyState from '../components/EmptyState'
import { personOf } from '../lib/kitchenFacts'

export default function MyRecipes() {
  const [mine, setMine] = useState([])
  const [handed, setHanded] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // ?person=Lola — where Home's "whose recipes live here" row lands. Without this
  // the row would navigate here and show an UNFILTERED kitchen, which reads as a
  // broken link rather than a filter.
  const person = params.get('person')

  useEffect(() => {
    client
      .get('/recipes')
      .then((res) => setMine(res.data))
      .catch(() => {})
  }, [])

  // Recipes handed TO this user, fetched only when filtering by a person, because
  // that row counts them: the person who SENT you a dish is the most important
  // name in the app, so excluding them would gut the section. The unfiltered
  // kitchen still means "what you kept", so no extra request for it.
  //
  // Held in its OWN state rather than appended to `mine`: two concurrent requests
  // writing one array means whichever resolves last wins, and the /recipes reply
  // would silently drop the handed ones.
  useEffect(() => {
    if (!person) return
    getSharedWithMe()
      .then((res) => setHanded(res.data))
      .catch(() => {})
  }, [person])

  const recipes = person ? [...mine, ...handed] : mine
  const query = search.trim()
  const searching = query.length > 0
  let filtered = person ? recipes.filter((r) => personOf(r) === person) : recipes
  if (searching) {
    filtered = filtered.filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase()),
    )
  }

  return (
    <div className="min-h-screen bg-cream px-5 pt-6 pb-6">
      <MarkerTitle
        color="bg-saffron"
        className="font-display font-black text-[32px] leading-none text-ink"
      >
        Your kitchen<span className="text-terra">.</span>
      </MarkerTitle>
      <p className="font-display italic text-[15px] text-ink-soft mt-3">
        {person ? `Everything from ${person}.` : 'Everything you’ve kept.'}
      </p>

      {person && (
        <button
          onClick={() => {
            const next = new URLSearchParams(params)
            next.delete('person')
            setParams(next, { replace: true })
          }}
          className="mt-3 mr-2 inline-block font-display font-bold text-[12px] text-ink bg-peach border-2 border-ink rounded-full px-3 py-1 shadow-[0_2px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-none"
        >
          {person} &times;
        </button>
      )}

      <button
        onClick={() => navigate('/shared')}
        className="mt-3 inline-block font-display font-bold text-[12px] text-ink bg-sage border-2 border-ink rounded-full px-3 py-1 shadow-[0_2px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-none"
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
        <EmptyState
          icon="🔍"
          badge="bg-brick"
          title={`No recipes match “${query}”`}
          sub="Try a different word."
          className="mt-8"
        />
      )}
      {!searching && person && filtered.length === 0 && recipes.length > 0 && (
        <EmptyState
          icon="🍲"
          title={`Nothing from ${person} here`}
          sub="Clear the filter to see everything you've kept."
          className="mt-8"
        />
      )}
      {!searching && !person && recipes.length === 0 && (
        <EmptyState
          icon="🍲"
          title="Your kitchen's empty"
          sub="Keep your first recipe to get started."
          className="mt-8"
        />
      )}
    </div>
  )
}
