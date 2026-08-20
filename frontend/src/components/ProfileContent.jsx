import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserRecipes } from '../api/sharing'
import { getUserPosts } from '../api/posts'
import RecipeCard from './RecipeCard'
import PostCard from './PostCard'
import Loader from './Loader'

// The recipes + posts of one person, as two tabs, for a profile page (#69). Used by
// UserProfile (someone else, visibility-gated server-side) and reusable by the "You"
// page later (#74). It does NOT decide what's visible — the two endpoints
// (/recipes/users/{id}, /posts/users/{id}) already gate on can_view / can_view_post,
// so whatever comes back is safe to render. This component just presents it.
//
// Each tab fetches lazily the first time it's opened and caches the result, so opening
// a profile only loads the recipes; posts load on the first tab switch.
export default function ProfileContent({ userId, emptyLabel }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('recipes')
  const [recipes, setRecipes] = useState(null) // null = not loaded yet
  const [posts, setPosts] = useState(null)

  // Reset when the profile changes (navigating between two people reuses this component).
  useEffect(() => {
    setTab('recipes')
    setRecipes(null)
    setPosts(null)
  }, [userId])

  // Lazy-load the active tab's data once.
  useEffect(() => {
    if (tab === 'recipes' && recipes === null) {
      getUserRecipes(userId).then((r) => setRecipes(r.data)).catch(() => setRecipes([]))
    }
    if (tab === 'posts' && posts === null) {
      getUserPosts(userId).then((r) => setPosts(r.data)).catch(() => setPosts([]))
    }
  }, [tab, userId, recipes, posts])

  const active = tab === 'recipes' ? recipes : posts

  return (
    <div className="mt-8">
      {/* Tab switcher — a segmented sticker pill, same language as the add-recipe
          say/type toggle so tabs read as one control, not two buttons. */}
      <div
        role="tablist"
        aria-label="Recipes or posts"
        className="flex justify-center"
      >
        <div className="inline-flex rounded-full border-2 border-ink bg-cream p-0.5 text-[13.5px] font-display font-bold">
          {['recipes', 'posts'].map((t) => (
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

      <div className="mt-5">
        {active === null ? (
          <Loader />
        ) : active.length === 0 ? (
          <p className="text-center font-display italic text-[14px] text-ink-soft py-8">
            {emptyLabel ||
              (tab === 'recipes' ? 'No recipes to see yet.' : 'No posts to see yet.')}
          </p>
        ) : tab === 'recipes' ? (
          // Two-up grid, matching MyRecipes/Browse.
          <div className="grid grid-cols-2 gap-4">
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onClick={() => navigate(`/recipes/${r.id}`)}
              />
            ))}
          </div>
        ) : (
          // Single column — PostCard is a full-width photo card and self-navigates.
          <div className="space-y-5">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
