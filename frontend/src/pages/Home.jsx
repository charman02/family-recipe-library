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

// The "issei." masthead — chunky Fraunces wordmark with the signature orange
// period, motto beneath (capitalized, punctuated).
function Masthead() {
  return (
    <div className="px-5 pt-6 pb-3">
      <h1 className="font-display font-black text-[34px] leading-[0.95] tracking-[-0.01em] text-ink">
        issei<span className="text-terra">.</span>
      </h1>
      <p className="font-display italic text-[15px] text-ink-soft mt-0.5">
        Recipes that live in memory.
      </p>
    </div>
  )
}

// Section header in the sticker language: a chunky Fraunces title with a bold
// ink underline rule.
function SectionTitle({ children }) {
  return (
    <div className="mb-3">
      <h3 className="font-display font-black text-[24px] text-ink leading-none inline-block border-b-[3px] border-ink pb-1">
        {children}
      </h3>
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

  // The greeting eyebrow as a small saffron sticker — the reference's badge motif.
  const eyebrow = (
    <span className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[10.5px] text-ink bg-saffron border-2 border-ink rounded-full px-3 py-1">
      {getGreeting()}, {user.first_name || 'friend'}
    </span>
  )

  // First-run: nothing kept yet. Big peach color-block hero + a sticker CTA.
  if (mine.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <Masthead />
        <div className="mx-4 sticker bg-peach px-6 pt-7 pb-8">
          {eyebrow}
          <h2 className="font-display font-medium text-[34px] leading-[1.05] text-ink mt-4 max-w-[16rem]">
            Every family has a dish that means{' '}
            <span className="font-black italic">home.</span>
          </h2>
          <p className="font-display text-[16px] text-ink-soft mt-4 max-w-xs leading-relaxed">
            Start with the one you&rsquo;d miss most — the taste you&rsquo;d want
            to keep forever.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="mt-6 rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
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

      {/* HERO — a big peach color-block sticker with a mixed-weight headline. */}
      <div className="mx-4 sticker bg-peach px-5 pt-6 pb-7">
        {eyebrow}
        <h2 className="font-display text-[38px] leading-[1.0] text-ink mt-4 max-w-[15rem]">
          What&rsquo;s cooking{' '}
          <span className="font-black italic">tonight?</span>
        </h2>
        <p className="font-display italic text-[15px] text-ink-soft mt-3">
          Everything you&rsquo;ve kept, in one kitchen.
        </p>
      </div>

      {/* CORAL ACCENT — an outlined coral sticker bar (the reference's red strip). */}
      <button
        onClick={() => navigate('/browse')}
        className="mx-4 mt-4 w-[calc(100%-2rem)] sticker sticker-press bg-coral px-5 py-3 flex items-center justify-between text-cream"
      >
        <span className="font-display font-black text-[16px]">
          {passedDown.length + mine.length} recipes to cook
        </span>
        <span className="font-display font-bold text-[13px]">Browse all →</span>
      </button>

      {/* SECTIONS — chunky Fraunces titles, two-up recipe-card grids. */}
      {passedDown.length > 0 && (
        <section className="px-5 pt-7">
          <SectionTitle>Passed down lately</SectionTitle>
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

      <section className="px-5 pt-8">
        <SectionTitle>Your kitchen</SectionTitle>
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
