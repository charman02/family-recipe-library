import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { getSharedWithMe } from '../api/sharing'
import RecipeCard from '../components/RecipeCard'
import MarkerTitle from '../components/MarkerTitle'
import Loader from '../components/Loader'
import Wordmark from '../components/Wordmark'
import { HeroStack } from '../components/HeroStack'
import { PeopleRow, FinishThese, KitchenGlance } from '../components/KitchenSections'

// The masthead: the wordmark sticker plus the motto.
//
// The motto sits BESIDE the mark rather than under it. Stacked, the pair was 60px of
// vertical real estate before any content, and the hero heading landed directly under
// the motto's italic — three lines of type in three styles, top to bottom, before the
// first recipe. Side by side, the block is one row and the hero heading is the next
// thing your eye reaches.
function Masthead() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
      <h1 className="flex-none">
        <Wordmark size="sm" />
      </h1>
      <p className="font-display italic text-[12.5px] leading-tight text-ink-soft">
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
          <h2 className="font-display font-medium text-[30px] leading-[1.08] text-ink max-w-[16rem]">
            Someone passed you a{' '}
            <span className="font-black italic">recipe.</span>
          </h2>
          <p className="font-display text-[15px] text-ink-soft mt-3 max-w-xs leading-snug">
            It&rsquo;s yours now — kept the way they make it, amounts and all.
            Cook it whenever you like.
          </p>
        </div>

        <section className="px-5 pt-7">
          <SectionTitle color="bg-sage">Passed to you</SectionTitle>
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
          <h2 className="font-display font-medium text-[32px] leading-[1.06] text-ink max-w-[16rem]">
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

  // "Passed down lately" = the public feed, excluding the user's own recipes. It
  // sits BELOW the user's own kitchen now. It used to sit above it, which meant a
  // user opening the app scrolled past strangers' dishes to reach their own — and
  // POSITIONING.md explicitly disclaims discovery-from-strangers as a selling
  // point, so having it outrank their own food contradicted the product.
  const passedDown = community.filter((r) => r.user_id !== user.id).slice(0, 12)

  // The hero names an actual dish rather than only asking a question. "What's
  // cooking tonight?" asked something and then answered it with a link to a list;
  // naming the most recent thing available makes the hero DO something. A recipe
  // someone sent you outranks one you wrote, because that's the moment this app
  // exists for.
  // THE HERO DECK. Recipes someone handed you come first — that hand-off is the
  // moment this app exists for — then your own. Capped at 4: the deck is a hero, not
  // a browser, and a fifth card is a swipe nobody will take when "Your kitchen" is
  // one scroll below. The heading names WHY the current card is here rather than
  // labelling it an editorial pick (see lib/heroReason.js).
  const deck = [...shared, ...mine].slice(0, 4)


  // Everything the explore sections read: the user's own kitchen plus what was
  // handed to them. Strangers' public recipes are excluded on purpose — "whose
  // recipes live here" means THIS kitchen, and quoting a stranger's step note
  // would make the section a feed, which is the thing the product disclaims.
  const kitchen = [...mine, ...shared]

  return (
    <div className="min-h-screen bg-cream pb-6">
      <Masthead />

      {/* HERO — one real recipe, opened. See HeroRecipe for why this replaced a
          peach box containing a question and three emoji discs: the hero held no
          content, and the app's actual beauty was buried below the fold.

          FOUR VARIANTS are live behind ?home=1|2|3|4 while the form is being
          chosen — the first rebuild fixed the hero's CONTENT but left its FORM
          identical to every card below it, which is what read as stale. See
          HeroVariants.jsx. Delete the switch and keep one once it's decided. */}
      <div className="mx-4">
        {deck.length > 0 ? (
          <HeroStack
            recipes={deck}
            shared={shared}
            count={mine.length + shared.length}
            onOpen={(r) => navigate(`/recipes/${r.id}`)}
          />
        ) : (
          /* Both first-run branches above catch an empty kitchen, so this only
             fires if both lists somehow load empty — keep a way in rather than
             rendering nothing. */
          <button
            onClick={() => navigate('/my-recipes')}
            className="w-full text-left sticker sticker-press bg-card px-5 pt-5 pb-5"
          >
            <p className="font-display font-black text-[24px] text-ink">
              Your kitchen &rarr;
            </p>
          </button>
        )}
      </div>

      {/* AT A GLANCE + WHOSE RECIPES LIVE HERE sit directly under the hero, before
          any grid. The page's problem wasn't its content, it was its SHAPE: hero,
          grid, grid, grid — one repeated rectangle with nothing to look at twice.
          A stat strip and a row of round faces break that up with the two things
          only this app knows: how much a kitchen has accumulated, and who it came
          from. Both are pure functions of data already on the page. */}
      <KitchenGlance recipes={kitchen} />
      <PeopleRow
        recipes={kitchen}
        onPerson={(p) => navigate(`/my-recipes?person=${encodeURIComponent(p.name)}`)}
      />

      {/* The brick "N recipes to cook / Browse all" bar used to sit here: a
          full-width saturated bar directly under the hero, competing with it for
          the same attention, pointing at the LEAST important destination on the
          page — and Browse already has its own nav tab. Its count summed
          `passedDown + mine`, mixing strangers' public recipes with the user's own
          into one number that meant nothing. Removed rather than restyled. */}

      {/* PASSED TO YOU comes first: a dish someone chose to send you is the
          reason this app exists, and it outranks anything you wrote yourself —
          let alone anything from a stranger. Shows 6 rather than 4; the old cap
          hid recipes on a screen with room for them. */}
      {shared.length > 0 && (
        <section className="px-5 home-section">
          <SectionTitle color="bg-sage" onClick={() => navigate('/shared')}>
            Passed to you
          </SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {shared.slice(0, 6).map((recipe) => (
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

      {/* A "Their words" quote card used to sit here — one line lifted out of a
          recipe. Removed: a folk amount or a step remark read as a fragment with the
          dish it belongs to nowhere in sight, so it was charming without being
          useful. The material didn't go to waste — it's now what fills the frame of
          a recipe with no photo, where it appears WITH its dish. See
          lib/coverText.js. */}

      {/* THEN the user's own kitchen. */}
      <section className="px-5 home-section">
        <SectionTitle color="bg-saffron" onClick={() => navigate('/my-recipes')}>
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

      {/* FILL THESE IN — the only section that ASKS for something, so it sits below
          both grids and is capped at three. It reads the user's own recipes only:
          nagging someone about gaps in a dish they were given would be asking them
          to edit a record that isn't theirs (and `patch_recipe` would refuse). */}
      <FinishThese
        recipes={mine}
        onOpen={(r) => navigate(`/recipes/${r.id}/edit`)}
      />

      {/* LAST, and only if there's anything public at all. Strangers' recipes are
          the least important thing on this page. */}
      {passedDown.length > 0 && (
        <section className="px-5 home-section">
          <SectionTitle color="bg-peach" onClick={() => navigate('/browse')}>
            Passed down lately
          </SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {passedDown.slice(0, 4).map((recipe) => (
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
    </div>
  )
}
