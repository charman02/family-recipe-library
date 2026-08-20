import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPost } from '../api/posts'
import BackButton from '../components/BackButton'
import Avatar from '../components/Avatar'
import Loader from '../components/Loader'

const fullName = (p) => `${p.author_first_name} ${p.author_last_name}`.trim()

// PostPage (/posts/:id) — a single shared meal, read-only. Reached by tapping a post in
// Browse (#71); also a real permalink for any post the viewer may see. Read authorization
// is the backend's: GET /posts/{id} returns the post only if can_view_post allows this
// viewer (author, a friend on a friends post, or ANYONE on a public one), else 404 — so a
// non-friend opening a public meal from Browse gets it, and a private/friends post they
// aren't entitled to reads as "not found", never confirming it exists.
//
// No like button (never), no request-the-recipe action yet (that's the Phase 2 loop). A
// post that HAS a recipe links through to it — the discovery payoff.
export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPost(id)
      .then((res) => setPost(res.data))
      .catch(() => setError('This meal isn’t available.'))
  }, [id])

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="error-pill">{error}</span>
        <BackButton to="/browse" label="Back" />
      </div>
    )
  }
  if (post === null) return <Loader />

  // Own post → your read-only self view is /profile ("You"); anyone else → their profile.
  const me = JSON.parse(localStorage.getItem('issei_user') || '{}')
  const isMine = String(me.id) === String(post.user_id)
  const openAuthor = () => navigate(isMine ? '/profile' : `/u/${post.user_id}`)

  return (
    <div className="min-h-screen bg-cream px-5 pt-4 pb-10">
      <div className="mb-3">
        <BackButton to="/browse" label="Back" />
      </div>

      <article className="sticker bg-card overflow-hidden">
        {/* Author header — tap to their profile. */}
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <button
            onClick={openAuthor}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <Avatar name={post.author_first_name} photoUrl={post.author_photo_url} size="sm" />
            <span className="font-display font-bold text-[14.5px] text-ink truncate">
              {fullName(post)}
            </span>
          </button>
        </div>

        {/* The meal photo. */}
        <img
          src={post.photo_url}
          alt={post.dish_name}
          className="w-full aspect-square object-cover block border-y-2 border-ink"
        />

        {/* Dish name + optional description. */}
        <div className="px-3.5 py-3">
          <h1 className="font-display font-black text-[22px] text-ink leading-tight">
            {post.dish_name}
          </h1>
          {post.description && (
            <p className="font-display text-[14.5px] text-ink-soft leading-snug mt-1.5">
              {post.description}
            </p>
          )}
          {/* Attached recipe → link through (the discovery payoff). recipe_id is already
              nulled by the API when the viewer can't open it, so this never dead-ends. */}
          {post.recipe_id && (
            <button
              onClick={() => navigate(`/recipes/${post.recipe_id}`)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 font-display font-bold text-[15px] text-cream bg-terra rounded-full px-3.5 py-3 border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
            >
              See the recipe &rarr;
            </button>
          )}
        </div>
      </article>
    </div>
  )
}
