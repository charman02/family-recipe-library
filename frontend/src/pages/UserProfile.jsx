import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getUserProfile,
  requestFriend,
  acceptFriend,
  removeFriend,
  getFriends,
  getFriendRequests,
} from '../api/friends'
import BackButton from '../components/BackButton'
import Loader from '../components/Loader'

const fullName = (p) => `${p.first_name} ${p.last_name}`.trim()

// A read-only look at another person: their name, how many of their recipes you
// can see, and a single friend button that reflects the current relationship.
// The recipe GRID and posts arrive with the feed (Phase 1); Phase 0 is the shell
// plus the friend action, so the graph is usable before there's anything to show.
export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The friendship row id — needed to accept/remove. Not on the profile payload
  // (which is relationship STATE, not the row), so look it up from the lists.
  const [friendshipId, setFriendshipId] = useState(null)

  const me = (() => {
    try {
      return JSON.parse(localStorage.getItem('issei_user') || '{}')
    } catch {
      return {}
    }
  })()
  const isSelf = String(me.id) === String(userId)

  function load() {
    getUserProfile(userId)
      .then((res) => setProfile(res.data))
      .catch(() => setError('Profile not found'))
    // Find the friendship row id (if any) so accept/remove have something to act on.
    if (!isSelf) {
      Promise.all([getFriends(), getFriendRequests()])
        .then(([fr, rq]) => {
          const match =
            fr.data.find((f) => String(f.user_id) === String(userId)) ||
            rq.data.find((r) => String(r.user_id) === String(userId))
          setFriendshipId(match ? match.id : null)
        })
        .catch(() => {})
    }
  }
  useEffect(load, [userId])

  async function act(fn) {
    setBusy(true)
    try {
      await fn()
      load()
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="error-pill">{error}</span>
        <BackButton label="Back" />
      </div>
    )
  }
  if (profile === null) return <Loader />

  // The one friend button, driven by state.
  function FriendButton() {
    if (isSelf) return null
    const base =
      'rounded-full border-[2.5px] border-ink px-6 py-2.5 font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform disabled:opacity-50'
    if (profile.friend_state === 'accepted') {
      return (
        <button
          disabled={busy}
          onClick={() => friendshipId && act(() => removeFriend(friendshipId))}
          className={`${base} bg-cream text-ink`}
        >
          Friends ✓
        </button>
      )
    }
    if (profile.friend_state === 'pending') {
      return profile.friend_can_accept ? (
        <button
          disabled={busy}
          onClick={() => friendshipId && act(() => acceptFriend(friendshipId))}
          className={`${base} bg-terra text-cream`}
        >
          Accept friend request
        </button>
      ) : (
        <button disabled className={`${base} bg-cream text-ink-soft`}>
          Requested
        </button>
      )
    }
    return (
      <button
        disabled={busy}
        onClick={() => act(() => requestFriend(Number(userId)))}
        className={`${base} bg-terra text-cream`}
      >
        Add friend
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-cream px-5 pt-5 pb-10">
      <div className="mb-6">
        <BackButton label="Back" />
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="flex items-center justify-center w-20 h-20 rounded-full bg-peach border-[2.5px] border-ink text-ink font-display font-black text-[32px] shadow-[0_4px_0_#2E3A24]">
          {(profile.first_name || '?').charAt(0).toUpperCase()}
        </span>
        <h1 className="font-display font-black text-[28px] text-ink leading-tight mt-4">
          {fullName(profile)}
        </h1>
        <p className="font-display italic text-[14px] text-ink-soft mt-1">
          {profile.recipe_count === 0
            ? 'No recipes to see yet'
            : `${profile.recipe_count} ${
                profile.recipe_count === 1 ? 'recipe' : 'recipes'
              } you can see`}
        </p>
        <div className="mt-5">
          <FriendButton />
        </div>
      </div>

      {/* The recipe grid + their posts land here with the feed (Phase 1). */}
    </div>
  )
}
