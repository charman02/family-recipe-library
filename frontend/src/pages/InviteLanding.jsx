import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInvitePreview } from '../api/lineage'
import RecipeBody from '../components/RecipeBody'
import Loader from '../components/Loader'

// The recipient landing (/invite/:token) — the far end of the handoff.
//
// This used to be a soft wall: name, who it's from, story, photo, then a signup
// gate before you could read a single ingredient. That inverted the point. The
// person holding this link has never tasted the dish and wants to cook it, so
// the recipe is OPEN here — the same <RecipeBody> the owner reads, cooking mode
// and all. The token is the permission.
//
// Signing up is what lets you KEEP it, cook it, and add what only you know — so
// the CTA sits under the recipe (where intent is highest after reading) with a
// light one at the top for anyone who already knows they want it.
export default function InviteLanding() {
  const { token } = useParams()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    getInvitePreview(token)
      .then(({ data }) => {
        if (live) setPreview(data)
      })
      .catch(() => {
        if (live) setError('This invite link is not valid or has expired.')
      })
    return () => {
      live = false
    }
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="error-pill">{error}</span>
        <Link
          to="/login"
          className="inline-block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
        >
          Go to issei
        </Link>
      </div>
    )
  }
  if (!preview) {
    return <Loader label="Opening…" />
  }

  const signupHref = `/login?tab=signup&invite=${token}`

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[430px] mx-auto px-5 pt-10 pb-10">
        {/* Whose hand this came from — the framing, before the dish. */}
        <div className="text-center">
          <h1 className="font-display font-black text-[26px] leading-none text-ink">
            issei<span className="text-terra">.</span>
          </h1>
          {preview.from_name && (
            <p className="font-display font-bold uppercase tracking-[0.18em] text-[11px] text-terra mt-5">
              {preview.from_name} passed you
            </p>
          )}
          <h2 className="font-display font-black text-[32px] leading-[1.05] text-ink mt-1.5">
            {preview.name}
          </h2>
          <p className="font-display text-[13px] text-ink-soft mt-3">
            Yours to read and cook — no account needed.
          </p>
        </div>

        {/* The recipe itself, exactly as the keeper reads it. */}
        <RecipeBody recipe={preview} />

        {/* The ask, placed AFTER the reading — once they know they want it. */}
        <div className="sticker bg-peach px-5 py-5 mt-8 text-center">
          <p className="font-display font-black text-[19px] text-ink leading-tight">
            Keep it in your kitchen
          </p>
          <p className="font-display text-[13.5px] text-ink-soft leading-snug mt-1.5">
            Make a free account to save this recipe, mark it cooked, and add the
            parts only you know.
          </p>
          <Link
            to={signupHref}
            className="block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform mt-4"
          >
            Keep this recipe →
          </Link>
        </div>
      </div>
    </div>
  )
}
