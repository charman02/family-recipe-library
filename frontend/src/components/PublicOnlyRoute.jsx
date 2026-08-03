import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { claimInvite } from '../api/sharing'
import Loader from './Loader'

// The mirror of ProtectedRoute: ProtectedRoute keeps a signed-OUT user off the
// kitchen, this keeps a signed-IN user off the sign-in screen. Login itself
// already replaces history after authenticating, which covers the common path;
// this covers every other way of arriving at /login — a typed URL, a stale
// bookmark, an old history entry, a link someone sent — where no auth happens
// and nothing would otherwise move them along.
//
// The one case where bouncing them is WRONG is an invite link. A handoff
// recipient is sent to `/login?tab=signup&invite=TOKEN`, and the claim only runs
// as part of signing in — so a signed-in user (already had an account, or came
// back to the link later) redirected to `/` would silently drop the token and
// never receive the recipe. That is a worse bug than the one this guard fixes,
// so the token is honored instead of discarded: the backend treats the token
// itself as the authorization and accepts a claim from any signed-in holder, so
// we claim it for the session in hand and land them on the recipe.
export default function PublicOnlyRoute({ children }) {
  const [searchParams] = useSearchParams()
  const signedIn = Boolean(localStorage.getItem('issei_token'))
  const inviteToken = searchParams.get('invite')
  const [claimedTo, setClaimedTo] = useState(null)

  useEffect(() => {
    if (!signedIn || !inviteToken) return
    let live = true
    claimInvite(inviteToken)
      .then(({ data }) => {
        // The grant names the recipe it was made for, so the returned recipe_id is the
        // recipe they were handed — go straight to it, not to a generic list.
        if (live) {
          setClaimedTo(
            data?.recipe_id ? `/recipes/${data.recipe_id}` : '/shared',
          )
        }
      })
      .catch(() => {
        // Don't strand them on a dead end: the public preview reads the same
        // token, explains a genuine failure in the recipient's terms, and its
        // "Keep this recipe" link comes straight back here — so a transient
        // failure is retryable and a truly dead link says so.
        if (live) setClaimedTo(`/invite/${inviteToken}`)
      })
    return () => {
      live = false
    }
  }, [signedIn, inviteToken])

  if (!signedIn) return children
  if (inviteToken) {
    // Waiting on the claim, not on a decision — showing the sign-in form here
    // would flash a screen they should never see.
    if (!claimedTo) return <Loader label="Opening…" />
    return <Navigate to={claimedTo} replace />
  }
  // REPLACE, not push: a guard that pushes leaves /login in history, recreating
  // the exact "back goes to the sign-in screen" bug Login just stopped causing.
  return <Navigate to="/" replace />
}
