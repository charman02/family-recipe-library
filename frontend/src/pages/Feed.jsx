import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFeed } from '../api/posts'
import PostCard from '../components/PostCard'
import Wordmark from '../components/Wordmark'
import Loader from '../components/Loader'

// HOME is the feed now: what your friends are making, newest first. This replaced
// the old hero-deck/kitchen Home entirely — a scroll feed has no natural footer, and
// the Kitchen + Browse tabs already own your recipes. An empty feed is the make-or-
// break moment for a social feature, so it doesn't show a blank screen: it shows the
// two actions that fill it — share a meal, find friends (Phase 0's suggestions).

const PAGE = 30 // must match the backend FEED_PAGE; a short page means "maybe more"

function Masthead() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
      <h1 className="flex-none">
        <Wordmark size="sm" />
      </h1>
      <p className="font-display italic text-[12.5px] leading-tight text-ink-soft">
        What your friends are making.
      </p>
    </div>
  )
}

export default function Feed() {
  const [posts, setPosts] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getFeed()
      .then((res) => {
        setPosts(res.data)
        if (res.data.length < PAGE) setReachedEnd(true)
      })
      .catch(() => setPosts([]))
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd || !posts || posts.length === 0) return
    setLoadingMore(true)
    try {
      const { data } = await getFeed(posts[posts.length - 1].id)
      setPosts((prev) => [...prev, ...data])
      if (data.length < PAGE) setReachedEnd(true)
    } catch {
      // A failed page-load just stops "load more"; the feed already shown stays.
      setReachedEnd(true)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, reachedEnd, posts])

  if (posts === null) return <Loader />

  return (
    <div className="min-h-screen bg-cream pb-6">
      <Masthead />

      {posts.length === 0 ? (
        // ONBOARDING EMPTY STATE — the cold-start fix. Not a blank screen: the two
        // acts that make the feed come alive.
        <div className="px-5 pt-6">
          <div className="mx-auto sticker bg-peach px-5 pt-7 pb-6 text-center">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cream border-2 border-ink shadow-[0_3px_0_#2E3A24] text-[26px] leading-none mb-3">
              🍳
            </span>
            <h2 className="font-display font-black text-[22px] text-ink leading-tight">
              Nothing cooking yet
            </h2>
            <p className="font-display text-[14px] text-ink-soft leading-snug mt-2 max-w-xs mx-auto">
              Share what you made, or find the people you cook with — their meals
              will show up here.
            </p>
            <div className="flex flex-col gap-2.5 mt-5">
              <button
                onClick={() => navigate('/add/meal')}
                className="rounded-full bg-terra text-cream border-[2.5px] border-ink px-6 py-2.5 font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
              >
                📸 Share a meal
              </button>
              <button
                onClick={() => navigate('/friends')}
                className="rounded-full bg-cream text-ink border-[2.5px] border-ink px-6 py-2.5 font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
              >
                🧑‍🍳 Find friends
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 space-y-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {!reachedEnd && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 font-display font-bold text-[14px] text-terra disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
