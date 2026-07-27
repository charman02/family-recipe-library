import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import RecipeCard from '../components/RecipeCard'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// The "issei." masthead — Fraunces wordmark with the signature orange period,
// and the motto beneath (capitalized, punctuated).
function Masthead() {
  return (
    <div className="px-5 pt-6 pb-4 bg-cream">
      <h1 className="font-display font-black text-[34px] leading-[0.95] tracking-[-0.01em] text-ink">
        issei<span className="text-terra">.</span>
      </h1>
      <p className="font-display italic text-[15px] text-ink-soft mt-0.5">
        Recipes that live in memory.
      </p>
    </div>
  )
}

export default function Home() {
  // mine = recipes the user has kept; community = everyone's feed (newest first)
  const [mine, setMine] = useState(null)
  const [community, setCommunity] = useState([])
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('issei_user') || '{}')

  useEffect(() => {
    client
      .get('/recipes')
      .then((res) => setMine(res.data))
      .catch(() => setMine([]))
    client
      .get('/recipes/browse')
      .then((res) => setCommunity(res.data))
      .catch(() => setCommunity([]))
  }, [])

  if (mine === null) {
    return (
      <div className="min-h-screen bg-cream p-6 text-center font-display italic text-ink-soft">
        Loading…
      </div>
    )
  }

  // First-run: nothing kept yet. Hero band + CTA (bottom nav still offers Add).
  if (mine.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <Masthead />
        <div className="bg-peach px-6 pt-10 pb-12">
          <p className="font-display font-bold uppercase tracking-[0.2em] text-[11px] text-terra">
            {getGreeting()}, {user.first_name || 'friend'}
          </p>
          <h2 className="font-display font-medium text-[34px] leading-[1.05] text-ink mt-3 max-w-[16rem]">
            Every family has a dish that means{' '}
            <span className="font-black italic">home.</span>
          </h2>
          <p className="font-display text-[16px] text-ink-soft mt-4 max-w-xs leading-relaxed">
            Start with the one you&rsquo;d miss most — the taste you&rsquo;d want
            to keep forever.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="mt-6 rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream shadow-[0_6px_0_#7c351a] active:translate-y-[3px] active:shadow-[0_3px_0_#7c351a] transition"
          >
            Keep your first recipe →
          </button>
        </div>
      </div>
    )
  }

  // "Passed down lately" = the community feed, excluding the user's own recipes.
  const passedDown = community.filter((r) => r.user_id !== user.id).slice(0, 12)

  return (
    <div className="min-h-screen bg-cream pb-6">
      <Masthead />

      {/* HERO BAND — peach panel, mixed-weight display headline (reference look) */}
      <div className="bg-peach px-5 pt-7 pb-8">
        <p className="font-display font-bold uppercase tracking-[0.2em] text-[11px] text-terra">
          {getGreeting()}, {user.first_name || 'friend'}
        </p>
        <h2 className="font-display text-[38px] leading-[1.0] text-ink mt-2 max-w-[15rem]">
          What&rsquo;s cooking{' '}
          <span className="font-black italic">tonight?</span>
        </h2>
        <p className="font-display italic text-[15px] text-ink-soft mt-3">
          Everything you&rsquo;ve kept, in one kitchen.
        </p>
      </div>

      {/* CORAL ACCENT BAR — the reference's red strip */}
      <button
        onClick={() => navigate('/browse')}
        className="w-full bg-coral px-5 py-3 flex items-center justify-between text-cream"
      >
        <span className="font-display font-black text-[15px]">
          {passedDown.length + mine.length} recipes to cook
        </span>
        <span className="font-display font-bold text-[13px]">Browse all →</span>
      </button>

      {/* SECTIONS — big Fraunces titles, two-up recipe-card grids */}
      {passedDown.length > 0 && (
        <section className="px-5 pt-6">
          <h3 className="font-display font-bold text-[24px] text-ink leading-none mb-3">
            Passed down lately
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {passedDown.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                variant="grid"
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pt-7">
        <h3 className="font-display font-bold text-[24px] text-ink leading-none mb-3">
          Your kitchen
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {mine.slice(0, 12).map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              variant="grid"
              onClick={() => navigate(`/recipes/${recipe.id}`)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
