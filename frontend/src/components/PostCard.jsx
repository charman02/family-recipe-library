import { useNavigate } from 'react-router-dom'

// A single meal in the feed: the photo big, then who made it and what it is.
// Deliberately quiet on actions in Phase 1 — no like button (never), and the
// "request the recipe" action arrives in Phase 2. For now a post that HAS a recipe
// links through to it; one that doesn't is just the moment.

// Short relative time — "just now / 3h / 2d / Aug 4". Kept tiny and local; the feed
// doesn't need a date library for this.
//
// The API serializes created_at as a NAIVE (timezone-less) UTC string, e.g.
// "2026-08-18T21:37:06". JS's Date() parses a timezone-less ISO string as LOCAL
// time, which skews the age by the viewer's UTC offset — a fresh post reads "just
// now" for hours in the Americas, or "8h" immediately east of UTC. Force UTC by
// appending 'Z' when the string carries no zone. (Scoped here — this is the app's
// only relative-time render; a server-side tz change would touch every schema and
// the existing Browse sort.)
function toUtcMs(iso) {
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`).getTime()
}

function ago(iso) {
  const then = toUtcMs(iso)
  const now = Date.now()
  const s = Math.max(0, Math.round((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(toUtcMs(iso)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const fullName = (p) => `${p.author_first_name} ${p.author_last_name}`.trim()

export default function PostCard({ post }) {
  const navigate = useNavigate()
  const initial = (post.author_first_name || '?').charAt(0).toUpperCase()

  return (
    <article className="sticker bg-card overflow-hidden">
      {/* Header: who + when. Tapping the name opens their profile. */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <button
          onClick={() => navigate(`/u/${post.user_id}`)}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <span className="flex-none flex items-center justify-center w-9 h-9 rounded-full bg-peach border-2 border-ink text-ink font-display font-black text-[15px]">
            {initial}
          </span>
          <span className="font-display font-bold text-[14.5px] text-ink truncate">
            {fullName(post)}
          </span>
        </button>
        <span className="ml-auto flex-none font-display text-[12px] text-ink-soft">
          {ago(post.created_at)}
        </span>
      </div>

      {/* The photo — the point of the post. */}
      <img
        src={post.photo_url}
        alt={post.dish_name}
        className="w-full aspect-square object-cover block border-y-2 border-ink"
      />

      {/* Dish name + optional line. */}
      <div className="px-3.5 py-3">
        <h3 className="font-display font-black text-[18px] text-ink leading-tight">
          {post.dish_name}
        </h3>
        {post.description && (
          <p className="font-display text-[14px] text-ink-soft leading-snug mt-1">
            {post.description}
          </p>
        )}
        {/* A post that has a recipe links through to it. (The "request the recipe"
            action for posts WITHOUT one lands in Phase 2.) */}
        {post.recipe_id && (
          <button
            onClick={() => navigate(`/recipes/${post.recipe_id}`)}
            className="mt-2.5 inline-flex items-center gap-1 font-display font-bold text-[13px] text-terra"
          >
            See the recipe &rarr;
          </button>
        )}
      </div>
    </article>
  )
}
