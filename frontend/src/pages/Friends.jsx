import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFriends,
  getFriendRequests,
  getFriendSuggestions,
  acceptFriend,
  removeFriend,
  requestFriend,
} from '../api/friends'
import MarkerTitle from '../components/MarkerTitle'
import BackButton from '../components/BackButton'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import Avatar from '../components/Avatar'
import { toUserMessage } from '../api/client'

const fullName = (p) => `${p.first_name} ${p.last_name}`.trim()

// A person's avatar in a friends-list row — their photo (#33) or the monogram
// fallback, via the shared <Avatar>. `person` carries first_name + photo_url from the
// friend/request/suggestion payloads.
function Monogram({ person }) {
  return <Avatar name={person.first_name} photoUrl={person.photo_url} size="md" />
}

// Who you cook with. Three sections: requests waiting on you, people to add
// (seeded from who you've handed recipes to / received from), and current friends.
export default function Friends() {
  const [friends, setFriends] = useState(null)
  const [requests, setRequests] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function load() {
    getFriends()
      .then((res) => setFriends(res.data))
      .catch(() => setFriends([]))
    getFriendRequests()
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]))
    getFriendSuggestions()
      .then((res) => setSuggestions(res.data))
      .catch(() => setSuggestions([]))
  }
  useEffect(load, [])

  // One guarded runner for every friend action: blocks a double-tap (busy), and
  // surfaces a failure through the app's single error-copy path instead of
  // swallowing it. A common cause is the row already being gone (the other party
  // unfriended/declined) — a refresh reconciles, so we reload either way.
  async function act(fn) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(toUserMessage(err, 'Couldn’t do that. Try again.'))
    } finally {
      setBusy(false)
      load()
    }
  }
  const onAccept = (id) => act(() => acceptFriend(id))
  const onRemove = (id) => act(() => removeFriend(id))
  const onAdd = (userId) => act(() => requestFriend(userId))

  if (friends === null) return <Loader />

  const nothingAnywhere =
    friends.length === 0 && requests.length === 0 && suggestions.length === 0

  return (
    <div className="min-h-screen bg-cream px-5 pt-5 pb-10">
      <div className="mb-5">
        <BackButton to="/profile" label="You" />
      </div>
      <MarkerTitle
        color="bg-peach"
        className="font-display font-black text-[32px] text-ink leading-none"
      >
        Friends<span className="text-terra">.</span>
      </MarkerTitle>
      <p className="font-display italic text-[15px] text-ink-soft mt-2 mb-6">
        The people you share recipes with.
      </p>

      {error && (
        <p className="mb-4">
          <span className="error-pill">{error}</span>
        </p>
      )}

      {nothingAnywhere && (
        <EmptyState
          icon="🧑‍🍳"
          badge="bg-peach"
          title="No one here yet"
          sub="When you hand someone a recipe — or they hand you one — they’ll show up here to add."
          className="mt-6"
        />
      )}

      {/* Requests waiting on you — first, because they need an answer. */}
      {requests.length > 0 && (
        <section className="mb-7">
          <h2 className="section-label mb-2.5">Wants to be friends</h2>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <div key={r.id} className="sticker bg-card flex items-center gap-3 p-3">
                <Monogram person={r} />
                <button
                  onClick={() => navigate(`/u/${r.user_id}`)}
                  className="min-w-0 flex-1 text-left font-display font-bold text-[15px] text-ink truncate"
                >
                  {fullName(r)}
                </button>
                <button
                  onClick={() => onAccept(r.id)}
                  disabled={busy}
                  className="flex-none rounded-full bg-terra text-cream border-2 border-ink px-4 py-1.5 font-display font-bold text-[13px] shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => onRemove(r.id)}
                  disabled={busy}
                  aria-label={`Decline ${fullName(r)}`}
                  className="flex-none font-display font-bold text-[13px] text-ink-soft px-1 disabled:opacity-50"
                >
                  Ignore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* People to add — seeded from the handoff graph. */}
      {suggestions.length > 0 && (
        <section className="mb-7">
          <h2 className="section-label mb-2.5">People you’ve shared recipes with</h2>
          <div className="space-y-2.5">
            {suggestions.map((s) => (
              <div
                key={s.user_id}
                className="sticker bg-card flex items-center gap-3 p-3"
              >
                <Monogram person={s} />
                <button
                  onClick={() => navigate(`/u/${s.user_id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block font-display font-bold text-[15px] text-ink truncate">
                    {fullName(s)}
                  </span>
                  <span className="block font-display italic text-[12px] text-ink-soft">
                    {s.reason === 'sent'
                      ? 'You sent them a recipe'
                      : 'Sent you a recipe'}
                  </span>
                </button>
                <button
                  onClick={() => onAdd(s.user_id)}
                  disabled={busy}
                  className="flex-none rounded-full bg-cream text-ink border-2 border-ink px-4 py-1.5 font-display font-bold text-[13px] shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Current friends. */}
      {friends.length > 0 && (
        <section>
          <h2 className="section-label mb-2.5">Friends</h2>
          <div className="space-y-2.5">
            {friends.map((f) => (
              <div key={f.id} className="sticker bg-card flex items-center gap-3 p-3">
                <Monogram person={f} />
                <button
                  onClick={() => navigate(`/u/${f.user_id}`)}
                  className="min-w-0 flex-1 text-left font-display font-bold text-[15px] text-ink truncate"
                >
                  {fullName(f)}
                </button>
                <button
                  onClick={() => onRemove(f.id)}
                  disabled={busy}
                  className="flex-none font-display font-bold text-[13px] text-ink-soft px-1 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
