import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'

// An icon-only sticker back button for sub-pages reached from the 5 main tabs.
//
// It prefers REAL history: when the user got here from another in-app screen, Back pops
// that screen (`navigate(-1)`), so it returns to wherever they actually came from — not a
// fixed guess. `to` is a FALLBACK, used only when there's no in-app history to pop (a
// shared link opened in a fresh tab, a bookmarked URL), so Back still lands somewhere
// sensible instead of doing nothing or leaving the app.
//
// Why this matters (the #76 bug): a page reachable from more than one place — e.g.
// /friends, now reached from the feed's "Find friends" AND the You page — can't hardcode
// one destination without sending half its visitors to the wrong tab. React Router tags
// the first location of a session with `location.key === 'default'`; any in-app
// navigation gives a unique key, which is how we tell "came from inside the app" from
// "landed here cold".
//
// `onClick` still fully overrides (multi-step in-page flows step back through their own
// state). `label` is the accessible name only — the button shows just the arrow in a pill.
export default function BackButton({ to, onClick, label = 'Back', className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  // CAVEAT for future placement: a `<Navigate replace>` mints a fresh (non-'default') key,
  // so a page that is itself the TARGET of a cold redirect would carry a non-default key
  // with nothing safe behind it — Back would `navigate(-1)` and could leave the app rather
  // than use `to`. No such page exists today (every BackButton sits behind ProtectedRoute,
  // which redirects OUT to /login, never into a BackButton page). If you add a BackButton
  // to a redirect target, gate on real history depth instead of just the key.
  const handleClick = onClick
    ? onClick
    : () => (location.key !== 'default' ? navigate(-1) : navigate(to || '/'))

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-ink bg-cream text-ink shadow-[0_3px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] ${className}`}
    >
      <Icon name="back" className="w-5 h-5" />
    </button>
  )
}
