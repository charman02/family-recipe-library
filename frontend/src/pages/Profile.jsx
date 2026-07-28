import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MarkerTitle from '../components/MarkerTitle'

// Client-side display preferences (no backend needed). Persisted in localStorage
// so they survive reloads; real account edits (name/email/password) need a
// backend endpoint that doesn't exist yet, so those are shown as "coming soon".
const PREFS_KEY = 'issei_prefs'
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

// A quiet toggle switch in the sticker language.
function Toggle({ on, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex items-center justify-between w-full py-2.5"
    >
      <span className="font-display font-bold text-[14px] text-ink">{label}</span>
      <span
        className={`relative w-12 h-7 rounded-full border-2 border-ink transition-colors ${
          on ? 'bg-mint' : 'bg-cream'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-ink transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

// A row that opens a settings action; disabled rows read "Soon".
function SettingRow({ label, onClick, soon = false }) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className="flex items-center justify-between w-full py-3 border-t-2 border-line first:border-t-0 text-left disabled:cursor-default"
    >
      <span className="font-display font-bold text-[14px] text-ink">{label}</span>
      {soon ? (
        <span className="font-display font-bold text-[10px] uppercase tracking-[0.1em] text-ink bg-saffron border-2 border-ink rounded-full px-2 py-0.5">
          Soon
        </span>
      ) : (
        <span className="font-display font-bold text-terra text-[18px] leading-none">
          ›
        </span>
      )}
    </button>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('issei_user') || '{}')
  const [prefs, setPrefs] = useState(loadPrefs)

  function setPref(key, val) {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  function handleLogout() {
    localStorage.removeItem('issei_token')
    localStorage.removeItem('issei_user')
    navigate('/login')
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const monogram = (fullName || user.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  // External feedback form (Tally / Google Forms). Set VITE_FEEDBACK_URL to
  // enable the button; left unset, the button stays hidden.
  const feedbackUrl = import.meta.env.VITE_FEEDBACK_URL

  return (
    <div className="min-h-screen bg-cream px-5 pt-6">
      <MarkerTitle
        color="bg-periwinkle"
        className="font-display font-black text-[32px] text-ink leading-none"
      >
        You<span className="text-terra">.</span>
      </MarkerTitle>

      {/* ACCOUNT — identity card. */}
      <div className="sticker bg-card p-5 mt-6">
        <div className="w-16 h-16 rounded-full bg-periwinkle text-cream font-display font-black text-3xl flex items-center justify-center border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] mb-4">
          {monogram}
        </div>
        {fullName && (
          <p className="font-display font-black text-[22px] text-ink">
            {fullName}
          </p>
        )}
        <p className="section-label mt-3">Email</p>
        <p className="font-sans text-[14px] text-ink mt-0.5">
          {user.email || 'Unknown'}
        </p>
      </div>

      {/* SETTINGS. */}
      <h2 className="font-display font-black text-[19px] text-ink mt-7 mb-2">
        Settings
      </h2>
      <div className="sticker bg-card px-5 py-2">
        <Toggle
          label="Reduce motion"
          on={!!prefs.reduceMotion}
          onChange={(v) => setPref('reduceMotion', v)}
        />
        <div className="border-t-2 border-line">
          <Toggle
            label="Cooking mode by default"
            on={!!prefs.cookingByDefault}
            onChange={(v) => setPref('cookingByDefault', v)}
          />
        </div>
      </div>

      {/* ACCOUNT ACTIONS — real edits need a backend endpoint (none yet). */}
      <h2 className="font-display font-black text-[19px] text-ink mt-7 mb-2">
        Account
      </h2>
      <div className="sticker bg-card px-5 py-1">
        <SettingRow label="Edit name" soon />
        <SettingRow label="Change email" soon />
        <SettingRow label="Change password" soon />
      </div>

      {/* Send feedback — opens an external hosted form (Tally/Google Forms) in
          a new tab. Wired to VITE_FEEDBACK_URL; hidden until that's set so it
          never links to nothing. Lightweight for launch; a native stored form
          is a tracked future to-do. */}
      {feedbackUrl && (
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mt-6 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-saffron border-[2.5px] border-ink text-ink font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
        >
          💬 Send feedback
        </a>
      )}

      <button
        onClick={handleLogout}
        className="w-full py-3 mt-3 mb-2 rounded-full bg-cream border-[2.5px] border-ink text-terra font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
      >
        Log out
      </button>

      {/* A warm, deliberately-vague "this is alive" note — no dates, no list. */}
      <p className="text-center font-display italic text-[13.5px] text-ink-soft mt-6 mb-2">
        More ways to share and connect are on the way. 💛
      </p>
    </div>
  )
}
