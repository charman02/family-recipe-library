import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { toUserMessage } from '../api/client'
import MarkerTitle from '../components/MarkerTitle'

// Client-side display preferences (no backend needed). Persisted in localStorage
// so they survive reloads. Account edits (name/email/password) DO hit the backend
// now — PATCH /auth/me — and refresh the cached issei_user afterward.
const PREFS_KEY = 'issei_prefs'
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

// A quiet toggle switch in the sticker language. `hint` is a plain-language line
// under the label saying what flipping it actually changes — added because
// testing showed the bare labels ("Reduce motion") were read as jargon and
// skipped. Optional so a self-evident toggle isn't padded with a redundant line.
function Toggle({ on, onChange, label, hint }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex items-center justify-between gap-4 w-full py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block font-display font-bold text-[14px] text-ink">
          {label}
        </span>
        {hint && (
          <span className="block font-display italic text-[12px] text-ink-soft mt-0.5">
            {hint}
          </span>
        )}
      </span>
      <span
        className={`relative flex-none w-12 h-7 rounded-full border-2 border-ink transition-colors ${
          on ? 'bg-sage' : 'bg-cream'
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

// An account row that expands into its own edit form. Closed, it's a labelled
// row with a chevron and (optionally) the current value; open, it shows `children`
// (the form) and a close control. One row open at a time is enforced by the parent.
function AccountRow({ label, value, open, onToggle, children }) {
  return (
    <div className="border-t-2 border-line first:border-t-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between w-full py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block font-display font-bold text-[14px] text-ink">
            {label}
          </span>
          {value && !open && (
            <span className="block font-sans text-[12.5px] text-ink-soft mt-0.5 truncate">
              {value}
            </span>
          )}
        </span>
        <span
          className={`font-display font-bold text-terra text-[18px] leading-none transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  // Kept in state so an account edit re-renders the identity card immediately.
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('issei_user') || '{}'),
  )
  const [prefs, setPrefs] = useState(loadPrefs)

  // Which account row is open (only one at a time), plus the edit form's own state.
  const [openRow, setOpenRow] = useState(null) // 'name' | 'email' | 'password' | null
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [newEmail, setNewEmail] = useState(user.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountDone, setAccountDone] = useState('')

  function setPref(key, val) {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  // Open a row (or close it if it's already open), resetting the form fields to
  // the current values and clearing any stale message.
  function toggleRow(row) {
    setAccountError('')
    setAccountDone('')
    if (openRow === row) {
      setOpenRow(null)
      return
    }
    setFirstName(user.first_name || '')
    setLastName(user.last_name || '')
    setNewEmail(user.email || '')
    setNewPassword('')
    setCurrentPassword('')
    setOpenRow(row)
  }

  // PATCH /auth/me with only the fields this row changes, then refresh the cached
  // user so the identity card + localStorage agree with the server. The token is
  // keyed by user id, so a name/email change doesn't invalidate it.
  async function saveAccount(patch, doneMsg) {
    setSaving(true)
    setAccountError('')
    setAccountDone('')
    try {
      const { data } = await client.patch('/auth/me', patch)
      const next = {
        ...user,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
      }
      setUser(next)
      localStorage.setItem('issei_user', JSON.stringify(next))
      setAccountDone(doneMsg)
      setOpenRow(null)
    } catch (err) {
      setAccountError(toUserMessage(err, 'Could not save. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  function handleLogout() {
    localStorage.removeItem('issei_token')
    localStorage.removeItem('issei_user')
    navigate('/login')
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.')
      return
    }
    setDeleteError('')
    setDeleting(true)
    try {
      await client.delete('/auth/me', { data: { password: deletePassword } })
      localStorage.removeItem('issei_token')
      localStorage.removeItem('issei_user')
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(toUserMessage(err, 'Could not delete account. Try again.'))
    } finally {
      setDeleting(false)
    }
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const monogram = (fullName || user.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-cream px-5 pt-6">
      <MarkerTitle
        color="bg-peach"
        className="font-display font-black text-[32px] text-ink leading-none"
      >
        You<span className="text-terra">.</span>
      </MarkerTitle>

      {/* ACCOUNT — identity card. */}
      <div className="sticker bg-card p-5 mt-6">
        <div className="w-16 h-16 rounded-full bg-plum text-cream font-display font-black text-3xl flex items-center justify-center border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] mb-4">
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
      {/* Both labels say what you'd notice, and the hints say it again in full.
          "Reduce motion" is accessibility-spec jargon that means nothing to a
          cook, and "Cooking mode" was a name for a screen the user hadn't met
          yet — so this mirrors RecipeBody's toggle wording exactly, which is the
          control it actually presets. Rename them together or the setting starts
          describing a button that no longer exists. */}
      <div className="sticker bg-card px-5 py-2">
        <Toggle
          label="Turn off animations"
          hint="Things appear right away instead of sliding or fading in."
          on={!!prefs.reduceMotion}
          onChange={(v) => setPref('reduceMotion', v)}
        />
        <div className="border-t-2 border-line">
          <Toggle
            label="Open recipes at “Ingredients & steps”"
            hint="Skip the photo and story and go straight to ingredients and steps."
            on={!!prefs.cookingByDefault}
            onChange={(v) => setPref('cookingByDefault', v)}
          />
        </div>
      </div>

      {/* ACCOUNT ACTIONS — real edits via PATCH /auth/me. */}
      <h2 className="font-display font-black text-[19px] text-ink mt-7 mb-2">
        Account
      </h2>
      {accountDone && (
        <p className="mb-2 font-display font-bold text-[13px] text-ink bg-sage/50 border-2 border-ink rounded-[10px] px-3 py-2">
          {accountDone}
        </p>
      )}
      <div className="sticker bg-card px-5 py-1">
        {/* Edit name — low-risk, no password required. */}
        <AccountRow
          label="Edit name"
          value={fullName}
          open={openRow === 'name'}
          onToggle={() => toggleRow('name')}
        >
          <div className="flex gap-2">
            <input
              aria-label="First name"
              className="field flex-1"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              aria-label="Last name"
              className="field flex-1"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          {openRow === 'name' && accountError && (
            <p className="mt-2"><span className="error-pill">{accountError}</span></p>
          )}
          <button
            disabled={saving}
            onClick={() =>
              saveAccount(
                { first_name: firstName.trim(), last_name: lastName.trim() },
                'Your name is updated.',
              )
            }
            className="btn-primary mt-3 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </AccountRow>

        {/* Change email — requires the current password (it's a login identity). */}
        <AccountRow
          label="Change email"
          value={user.email}
          open={openRow === 'email'}
          onToggle={() => toggleRow('email')}
        >
          <input
            type="email"
            aria-label="New email"
            className="field mb-2"
            placeholder="New email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            type="password"
            aria-label="Current password"
            className="field"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          {openRow === 'email' && accountError && (
            <p className="mt-2"><span className="error-pill">{accountError}</span></p>
          )}
          <button
            disabled={saving}
            onClick={() =>
              saveAccount(
                { email: newEmail.trim(), current_password: currentPassword },
                'Your email is updated.',
              )
            }
            className="btn-primary mt-3 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save email'}
          </button>
        </AccountRow>

        {/* Change password — current password verified server-side before it changes. */}
        <AccountRow
          label="Change password"
          open={openRow === 'password'}
          onToggle={() => toggleRow('password')}
        >
          <input
            type="password"
            aria-label="Current password"
            className="field mb-2"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            aria-label="New password"
            className="field"
            placeholder="New password (at least 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {openRow === 'password' && accountError && (
            <p className="mt-2"><span className="error-pill">{accountError}</span></p>
          )}
          <button
            disabled={saving}
            onClick={() =>
              saveAccount(
                { new_password: newPassword, current_password: currentPassword },
                'Your password is updated.',
              )
            }
            className="btn-primary mt-3 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </AccountRow>
      </div>

      {/* Send feedback — now an in-app form (/feedback), replacing the external
          hosted form this used to open in a new tab. VITE_FEEDBACK_URL is gone
          rather than kept as a fallback: two routes to the same thing would split
          the reports across a Google Sheet and the database, and a stale env var
          on the deploy host would silently keep sending beta testers out of the
          app — the exact friction the native form exists to remove. The form is
          always shown, because unlike an external link it can't point at nothing. */}
      <button
        onClick={() => navigate('/feedback', { state: { from: '/profile' } })}
        className="w-full mt-6 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-saffron border-[2.5px] border-ink text-ink font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
      >
        💬 Send feedback
      </button>

      <button
        onClick={handleLogout}
        className="w-full py-3 mt-3 mb-2 rounded-full bg-cream border-[2.5px] border-ink text-terra font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
      >
        Log out
      </button>

      {/* Delete account — tucked below log out, behind a confirmation gate. */}
      <div className="mt-8 mb-4">
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="w-full text-center font-display text-[13px] text-ink-soft underline underline-offset-2"
          >
            Delete my account
          </button>
        ) : (
          <div className="sticker bg-card px-5 py-4">
            <p className="font-display font-black text-[15px] text-ink mb-1">
              This can't be undone.
            </p>
            <p className="font-display text-[13px] text-ink-soft mb-3">
              Your recipes, cook events, and all account data will be permanently deleted.
            </p>
            <input
              type="password"
              aria-label="Confirm password"
              className="field mb-2"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            {deleteError && (
              <p className="mb-2"><span className="error-pill">{deleteError}</span></p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDelete(false)
                  setDeletePassword('')
                  setDeleteError('')
                }}
                className="flex-1 py-2.5 rounded-full bg-cream border-[2.5px] border-ink font-display font-bold text-[13px] text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-terra border-[2.5px] border-ink font-display font-bold text-[13px] text-cream shadow-[0_3px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* A warm, deliberately-vague "this is alive" note — no dates, no list. */}
      <p className="text-center font-display italic text-[13.5px] text-ink-soft mt-2 mb-2">
        More ways to share and connect are on the way. 💛
      </p>
    </div>
  )
}
