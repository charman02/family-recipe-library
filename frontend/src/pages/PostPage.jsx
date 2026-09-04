import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPost, requestRecipe, retractRequest } from '../api/posts'
import { toUserMessage } from '../api/client'
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
// No like button, ever. ONE action, and it's the same either/or as the feed card: a post
// whose recipe you can read links through to it (the discovery payoff); one you can't gets
// "Ask for the recipe" (#79). This page especially needs the ask — it's where a STRANGER
// lands from Browse's Meals tab, which is exactly the person with no other way to reach the
// cook. The count is never shown here: it belongs to the cook alone, on /requests.
export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')
  // The ask (#79). Mirrors the server's answer; `asked` is seeded from the loaded post so a
  // reload or a return visit shows the true state rather than resetting to "not asked".
  const [asking, setAsking] = useState(false)
  const [asked, setAsked] = useState(false)
  const [askError, setAskError] = useState('')

  const me = JSON.parse(localStorage.getItem('issei_user') || '{}')
  const isMine = post ? String(me.id) === String(post.user_id) : false

  async function ask() {
    if (asking || !post) return
    setAsking(true)
    setAskError('')
    const next = !asked
    setAsked(next)
    try {
      const { data } = next ? await requestRecipe(post.id) : await retractRequest(post.id)
      setPost(data)
      setAsked(Boolean(data.requested_by_me))
    } catch (err) {
      setAsked(!next)
      setAskError(toUserMessage(err, 'Couldn’t ask just now. Try again.'))
    } finally {
      setAsking(false)
    }
  }

  useEffect(() => {
    getPost(id)
      .then((res) => {
        setPost(res.data)
        // Seed the ask state from the server, or a reload shows "Ask for the recipe" to
        // someone who already asked — and tapping it would then RETRACT the ask they
        // still wanted. Caught by its own test.
        setAsked(Boolean(res.data.requested_by_me))
      })
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
              nulled by the API when the viewer can't open it, so this never dead-ends —
              and that same nulling is why the ask below covers both "never written down"
              and "written but private" without distinguishing them. */}
          {post.recipe_id ? (
            <button
              onClick={() => navigate(`/recipes/${post.recipe_id}`)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 font-display font-bold text-[15px] text-cream bg-terra rounded-full px-3.5 py-3 border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
            >
              See the recipe &rarr;
            </button>
          ) : (
            !isMine && (
              <>
                <button
                  onClick={ask}
                  disabled={asking}
                  aria-pressed={asked}
                  className={`mt-3 w-full inline-flex items-center justify-center gap-2 font-display font-bold text-[15px] rounded-full px-3.5 py-3 border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform disabled:opacity-50 ${
                    asked ? 'bg-cream text-ink-soft' : 'bg-saffron text-ink'
                  }`}
                >
                  {asked ? 'Asked ✓' : 'Ask for the recipe'}
                </button>
                {askError && (
                  <p className="mt-2">
                    <span className="error-pill">{askError}</span>
                  </p>
                )}
              </>
            )
          )}
        </div>
      </article>
    </div>
  )
}
