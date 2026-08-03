import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { getSharedWithMe } from '../api/sharing'
import RecipeCard from '../components/RecipeCard'
import MarkerTitle from '../components/MarkerTitle'
import Loader from '../components/Loader'
import HeroDiscs from '../components/HeroDiscs'

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

// Section header in the sticker language: a chunky Fraunces title with a
// highlighter-marker swipe behind it. Optionally tappable (→ onClick), in which
// case it gets a trailing arrow to signal it's a link.
function SectionTitle({ children, color, onClick }) {
  const title = (
    <MarkerTitle
      as="h3"
      color={color}
      className="font-display font-black text-[24px] text-ink leading-none"
    >
      {children}
      {onClick && <span className="ml-1.5">&rarr;</span>}
    </MarkerTitle>
  )
  return (
    <div className="mb-4">
      {onClick ? (
        <button onClick={onClick} className="text-left">
          {title}
        </button>
      ) : (
        title
      )}
    </div>
  )
}

export default function Home() {
  // mine = recipes the user has kept; community = everyone's feed (newest first)
  const [mine, setMine] = useState(null)
  const [community, setCommunity] = useState([])
  // Recipes handed TO this user. Home used to ignore these entirely, which broke
  // the app's headline case: someone follows a texted link, signs up to keep the
  // recipe, the claim succeeds — and Home greets them with "you have nothing,
  // add your first recipe," discarding the one thing they came for. `shared` is
  // null until loaded so the empty state can't flash before the answer arrives.
  const [shared, setShared] = useState(null)
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
    getSharedWithMe()
      .then((res) => setShared(res.data))
      .catch(() => setShared([]))
  }, [])

  if (mine === null || shared === null) {
    return <Loader />
  }

  // The greeting eyebrow as a small saffron sticker — the reference's badge motif.
  const eyebrow = (
    <span className="inline-block font-display font-bold uppercase tracking-[0.14em] text-[10.5px] text-ink bg-saffron border-2 border-ink rounded-full px-3 py-1">
      {getGreeting()}, {user.first_name || 'friend'}
    </span>
  )

  // FIRST RUN, HOLDING A RECIPE. Someone handed this person a dish and they
  // signed up to keep it. That recipe is the best possible explanation of the
  // app — it's real, it's theirs, and it's the reason they're here — so it gets
  // the hero and no abstract pitch is shown at all. Teaching by showing, using
  // their own content rather than a sample.
  if (mine.length === 0 && shared.length > 0) {
    const first = shared[0]
    return (
      <div className="min-h-screen bg-cream pb-6">
        <Masthead />
        <div className="mx-4 sticker bg-peach px-5 pt-6 pb-6">
          {eyebrow}
          <h2 className="font-display font-medium text-[30px] leading-[1.08] text-ink mt-4 max-w-[16rem]">
            Someone passed you a{' '}
            <span className="font-black italic">recipe.</span>
          </h2>
          <p className="font-display text-[15px] text-ink-soft mt-3 max-w-xs leading-snug">
            It&rsquo;s yours now — kept the way they make it, amounts and all.
            Cook it whenever you like.
          </p>
        </div>

        <section className="px-5 pt-7">
          <SectionTitle color="bg-mint">Passed to you</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {shared.slice(0, 12).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                variant="grid"
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              />
            ))}
          </div>
        </section>

        {/* The other half of the app, offered only AFTER their recipe — not as a
            demand. A first-run user with something to read shouldn't be pushed
            to author before they've cooked. */}
        <div className="mx-5 mt-8 sticker bg-card px-5 py-4">
          <p className="font-display font-black text-[16px] leading-tight text-ink">
            Got one of your own?
          </p>
          <p className="font-display text-[13.5px] leading-snug text-ink-soft mt-1">
            Write down a dish the way it&rsquo;s really made, then send it to one
            person the way {first.author_full_name || 'they'} sent you this.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="mt-3.5 rounded-full bg-terra px-6 py-2.5 font-display font-bold text-[14px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
          >
            Keep a recipe →
          </button>
        </div>
      </div>
    )
  }

  // FIRST RUN, EMPTY-HANDED. This person signed themselves up, so nothing here
  // is theirs yet and there's nothing real to show them.
  //
  // This screen used to carry the whole pitch AND a sample recipe. /welcome now
  // runs immediately before it and shows that exact sample card, so keeping it
  // here meant the same illustration twice in ten seconds — which reads as the
  // app being unsure whether it already told you. Stripped to the headline plus
  // one line and the CTA: enough to orient someone who arrived without the
  // welcome (an older account, a cleared browser) without repeating it for
  // everyone who just finished it.
  if (mine.length === 0) {
    return (
      <div className="min-h-screen bg-cream pb-6">
        <Masthead />
        <div className="mx-4 sticker bg-peach px-6 pt-7 pb-7">
          {eyebrow}
          <h2 className="font-display font-medium text-[32px] leading-[1.06] text-ink mt-4 max-w-[16rem]">
            Keep one dish the way it&rsquo;s{' '}
            <span className="font-black italic">really made.</span>
          </h2>
          <p className="font-display text-[15.5px] text-ink-soft mt-3.5 max-w-xs leading-snug">
            Then send it to the one person who asked for it.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="mt-5 rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
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

      {/* HERO — a big peach color-block sticker; tapping it opens the kitchen.
          A trio of emoji discs sits INSIDE the box down the free right side,
          clear of the left-aligned text. */}
      <div className="relative mx-4">
        <button
          onClick={() => navigate('/my-recipes')}
          aria-label="Go to your kitchen"
          className="w-full text-left sticker sticker-press bg-peach px-5 pt-6 pb-7"
        >
          {eyebrow}
          <h2 className="font-display text-[38px] leading-[1.0] text-ink mt-4 max-w-[12rem]">
            What&rsquo;s cooking{' '}
            <span className="font-black italic">tonight?</span>
          </h2>
          <p className="font-display italic text-[15px] text-ink-soft mt-3 max-w-[13rem]">
            Everything you&rsquo;ve kept, in one kitchen. &rarr;
          </p>
        </button>
        {/* Decorative emoji discs — config-driven, with a ?discs drag editor.
            See HeroDiscs.jsx. */}
        <HeroDiscs />
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

      {/* PASSED TO YOU — recipes handed to this person, above the public feed
          because a dish someone chose to send them outranks anything from a
          stranger. Previously these were reachable only from a link buried on
          MyRecipes, so once a recipient added a recipe of their own, the recipe
          they joined for vanished from Home. */}
      {shared.length > 0 && (
        <section className="px-5 pt-7">
          <SectionTitle color="bg-mint" onClick={() => navigate('/shared')}>
            Passed to you
          </SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {shared.slice(0, 4).map((recipe) => (
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
        <SectionTitle color="bg-mint" onClick={() => navigate('/my-recipes')}>
          Your kitchen
        </SectionTitle>
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
