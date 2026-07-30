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
// Why a failure is NOT just "this link is dead": the recipient has no account
// and no support path, so a wrong diagnosis here costs them the recipe entirely
// — they conclude the sender's link is broken and give up. Only the server
// saying 404 means the link is genuinely gone; everything else is our problem
// and is worth retrying.
function describeFailure(err) {
  const status = err?.response?.status
  if (status === 404) {
    return {
      message: 'This link is no longer good — ask whoever sent it to pass it on again.',
      canRetry: false,
    }
  }
  if (status >= 500) {
    return { message: 'issei is having trouble right now.', canRetry: true }
  }
  if (!err?.response) {
    // No response at all: offline, DNS, CORS, or a request that timed out.
    return { message: "Couldn't reach issei — check your connection.", canRetry: true }
  }
  return { message: 'Something went wrong opening this recipe.', canRetry: true }
}

export default function InviteLanding() {
  const { token } = useParams()
  const [preview, setPreview] = useState(null)
  const [failure, setFailure] = useState(null)
  // Bumping this re-runs the fetch effect — the retry button's whole mechanism.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setFailure(null)
    getInvitePreview(token)
      .then(({ data }) => {
        if (live) setPreview(data)
      })
      .catch((err) => {
        if (live) setFailure(describeFailure(err))
      })
    return () => {
      live = false
    }
  }, [token, attempt])

  if (failure) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="error-pill">{failure.message}</span>
        {failure.canRetry && (
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
          >
            Try again
          </button>
        )}
        <Link
          to="/login"
          className={
            failure.canRetry
              ? 'font-display font-bold text-[14px] text-terra underline'
              : 'inline-block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform'
          }
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
