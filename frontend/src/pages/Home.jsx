import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import RecipeCard from '../components/RecipeCard'
import MarkerTitle from '../components/MarkerTitle'
import Loader from '../components/Loader'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Build a scalloped-badge outline (a bumpy "flower" circle) as one SVG path.
function scallopPath(cx, cy, R, bumps) {
  const rBump = R * Math.sin(Math.PI / bumps)
  const pt = (k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / bumps
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
  }
  const [x0, y0] = pt(0)
  let d = `M${x0.toFixed(2)},${y0.toFixed(2)}`
  for (let k = 1; k <= bumps; k++) {
    const [x, y] = pt(k)
    d += `A${rBump.toFixed(2)},${rBump.toFixed(2)} 0 0 1 ${x.toFixed(2)},${y.toFixed(2)}`
  }
  return d + 'Z'
}
const BADGE_SCALLOP = scallopPath(50, 50, 40, 12)

// A scalloped "sticker" badge with a chef-hat doodle inside — the reference's
// badge motif (cf. "Tim's Specialty!"), a spot of character by the hero.
function ChefBadge({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <path d={BADGE_SCALLOP} fill="#FBE0A8" stroke="#2E3A24" strokeWidth="4" />
      {/* chef's hat — puffy top over a tall banded base */}
      <path
        d="M35 58h30v-4c5 1.5 10-2 10-8s-5-9-9.5-8C65 31 58 27 50 27s-15 4-15.5 11C30 37 25 40 25 46s5 9.5 10 8z"
        fill="#FCF8EE"
        stroke="#2E3A24"
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      {/* the base band — tall, clean (no pleats), with a rounded bottom edge */}
      <path
        d="M35 58h30v11a3 3 0 0 1-3 3H38a3 3 0 0 1-3-3z"
        fill="#FCF8EE"
        stroke="#2E3A24"
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      {/* pleat hints on the puffy top */}
      <path d="M40 52v-6M50 53v-7M60 52v-6" stroke="#2E3A24" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
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

// Section header in the sticker language: a chunky Fraunces title with a
// highlighter-marker swipe behind it.
function SectionTitle({ children, color }) {
  return (
    <div className="mb-4">
      <MarkerTitle
        as="h3"
        color={color}
        className="font-display font-black text-[24px] text-ink leading-none"
      >
        {children}
      </MarkerTitle>
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
    return <Loader />
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

      {/* HERO — a big peach color-block sticker with a mixed-weight headline and
          a steaming-bowl doodle tucked in the corner for character. */}
      <div className="mx-4 sticker bg-peach px-5 pt-6 pb-7 relative overflow-hidden">
        {eyebrow}
        <div className="flex items-start justify-between gap-1">
          <h2 className="font-display text-[38px] leading-[1.0] text-ink mt-4 max-w-[12rem]">
            What&rsquo;s cooking{' '}
            <span className="font-black italic">tonight?</span>
          </h2>
          <ChefBadge className="w-[86px] h-[86px] flex-none mt-6 mr-12 rotate-[8deg] drop-shadow-[0_3px_0_#2E3A24]" />
        </div>
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
          {(() => {
            const n = passedDown.length + mine.length
            return `${n} ${n === 1 ? 'recipe' : 'recipes'} to cook`
          })()}
        </span>
        <span className="font-display font-bold text-[13px]">Browse all →</span>
      </button>

      {/* SECTIONS — chunky Fraunces titles, two-up recipe-card grids. */}
      {passedDown.length > 0 && (
        <section className="px-5 pt-7">
          <SectionTitle color="bg-saffron">Passed down lately</SectionTitle>
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
        <SectionTitle color="bg-mint">Your kitchen</SectionTitle>
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
