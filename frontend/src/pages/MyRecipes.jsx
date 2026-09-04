import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { getSharedWithMe, getKept } from '../api/sharing'
import { getUserPosts } from '../api/posts'
import RecipeCard from '../components/RecipeCard'
import PostCard from '../components/PostCard'
import IconField from '../components/IconField'
import MarkerTitle from '../components/MarkerTitle'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { personOf } from '../lib/kitchenFacts'

export default function MyRecipes() {
  const [mine, setMine] = useState([])
  const [handed, setHanded] = useState([])
  const [myPosts, setMyPosts] = useState(null) // null = not loaded (lazy, posts tab only)
  // The Kept shelf (#57): { recipes, unreachable_count }. null = not loaded (lazy).
  const [keptShelf, setKeptShelf] = useState(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Your kitchen now holds both your recipes and your posts (the #69 self-view). Which
  // tab shows is driven by ?tab=posts so the "You" page's Posts count can deep-link
  // straight here. Default (no param) = recipes, the primary content.
  const me = JSON.parse(localStorage.getItem('issei_user') || '{}')
  // Three tabs (#57 added Kept): recipes you wrote | recipes that are in your kitchen but
  // aren't yours | meals you shared. `recipes` is the default and carries no param, so
  // existing links to /my-recipes and /my-recipes?tab=posts keep working unchanged.
  const rawTab = params.get('tab')
  const tab = rawTab === 'posts' ? 'posts' : rawTab === 'kept' ? 'kept' : 'recipes'
  function setTab(next) {
    const p = new URLSearchParams(params)
    if (next === 'recipes') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

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

  // Your own posts, loaded lazily the first time the Posts tab is opened (self id →
  // GET /posts/users/{me}, which returns all your own posts).
  // The Kept shelf, loaded the first time that tab is opened. The server merges recipes
  // handed to you with ones you kept and re-checks can_view on every read, so anything
  // the cook has since restricted or deleted arrives only as a count.
  useEffect(() => {
    if (tab !== 'kept' || keptShelf !== null) return
    getKept()
      .then((res) => setKeptShelf(res.data))
      .catch(() => setKeptShelf({ recipes: [], unreachable_count: 0 }))
  }, [tab, keptShelf])

  useEffect(() => {
    if (tab !== 'posts' || myPosts !== null || !me.id) return
    getUserPosts(me.id)
      .then((res) => setMyPosts(res.data))
      .catch(() => setMyPosts([]))
  }, [tab, myPosts, me.id])

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
        {person
          ? `Everything from ${person}.`
          : tab === 'posts'
            ? 'Meals you’ve shared.'
            : tab === 'kept'
              ? 'Sent to you, and ones you kept.'
              : // Was "Everything you've kept" over a grid that only ever held recipes
                // you wrote — false before the Kept tab existed, and doubly so now.
                'Recipes you’ve written down.'}
      </p>

      {/* Recipes | Kept | Posts tabs. "Kept" (#57) is where recipes that aren't yours
          live — ones people handed you and ones you kept from Browse — which is what
          makes the invite page's promise ("keeps this recipe in your kitchen") literally
          true and retires the separate "Shared with you" page. Hidden while filtering by
          a person (that view is recipe-specific). Narrower padding than two tabs so three
          still fit the 430px column. */}
      {!person && (
        <div role="tablist" aria-label="Recipes, kept, or posts" className="flex justify-center mt-4">
          <div className="inline-flex rounded-full border-2 border-ink bg-cream p-0.5 text-[13px] font-display font-bold">
            {['recipes', 'kept', 'posts'].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`px-5 py-1.5 rounded-full capitalize transition ${
                  tab === t ? 'bg-terra text-cream' : 'text-ink-soft'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POSTS TAB */}
      {tab === 'posts' && !person ? (
        myPosts === null ? (
          <Loader />
        ) : myPosts.length === 0 ? (
          <EmptyState
            icon="📸"
            title="No posts yet"
            sub="Share a meal from the Add tab and it’ll show up here."
            className="mt-8"
          />
        ) : (
          <div className="space-y-5 mt-5">
            {myPosts.map((p) => (
              // onOpen makes the photo a tap target through to the post's own page —
              // without it your own meal is a dead end here, and the delete control that
              // lives on that page is unreachable from your kitchen.
              <PostCard key={p.id} post={p} onOpen={() => navigate(`/posts/${p.id}`)} />
            ))}
          </div>
        )
      ) : tab === 'kept' && !person ? (
        /* KEPT TAB (#57) — recipes in your kitchen that aren't yours: handed to you, or
           kept by you. Each is still the cook's single recipe, so tapping one opens
           their page (with the byline and the Kept button), not a copy of yours. */
        keptShelf === null ? (
          <Loader />
        ) : (
          <>
            {keptShelf.recipes.length === 0 ? (
              <EmptyState
                icon="🍲"
                title="Nothing kept yet"
                sub="Recipes people send you land here — and you can keep any recipe you find in Browse."
                className="mt-8"
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 mt-5">
                {keptShelf.recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    variant="grid"
                    onClick={() => navigate(`/recipes/${recipe.id}`)}
                  />
                ))}
              </div>
            )}
            {/* A bare count, never a dish name: it says something you kept is gone
                without disclosing which choice the cook made about it. PAST tense, because
                the shelf entry is removed for good — losing access is permanent, so if the
                cook re-opens the recipe later it does NOT come back on its own. That's why
                the line says to ask them, rather than implying it might return. */}
            {keptShelf.unreachable_count > 0 && (
              <p className="font-display text-[13px] text-ink-soft leading-snug mt-5">
                {keptShelf.unreachable_count}{' '}
                {keptShelf.unreachable_count === 1 ? 'recipe was' : 'recipes were'} removed
                from your kitchen. Whoever shared{' '}
                {keptShelf.unreachable_count === 1 ? 'it' : 'them'} changed who can see{' '}
                {keptShelf.unreachable_count === 1 ? 'it' : 'them'}, or removed{' '}
                {keptShelf.unreachable_count === 1 ? 'it' : 'them'}. Ask them to share{' '}
                {keptShelf.unreachable_count === 1 ? 'it' : 'them'} again if you'd like{' '}
                {keptShelf.unreachable_count === 1 ? 'it' : 'them'} back.
              </p>
            )}
          </>
        )
      ) : (
      <>
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

      {/* The "Shared with you →" chip is gone: recipes people sent you now live in the
          Kept tab above, beside the ones you kept yourself. One shelf, one place to look. */}

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
      </>
      )}
    </div>
  )
}
