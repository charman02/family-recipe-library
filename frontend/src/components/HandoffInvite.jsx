import { useState } from 'react'
import { handoffRecipe } from '../api/lineage'
import { HANDOFF_STARTERS, defaultStarterKey } from '../lib/handoffStarters'

// Pass-it-on: hand this recipe to a specific person.
//
// Two stages:
//   1. COMPOSE — an optional note (+ optional email, which enables auto-accept
//      when that address signs up). Neither is required: the fast path is just
//      tapping the button to mint a link.
//   2. SHARE   — the invite link, with the native share sheet (iMessage/WhatsApp/
//      anything) and a copy fallback. This stage is the whole point: previously
//      the token was minted and thrown away, so the recipient was never told.
//
// `onDone` fires when the sender finishes (after sharing) — callers used to get
// `onSent` immediately on send, which skipped the share step entirely.
export default function HandoffInvite({
  recipeId,
  recipeName = 'this recipe',
  recipeVisibility = 'private',
  sourceName = null,
  onSent,
  onSkip,
}) {
  const seedKey = defaultStarterKey(sourceName)
  const seedNote = seedKey
    ? HANDOFF_STARTERS.find((s) => s.key === seedKey).note
    : ''
  const [email, setEmail] = useState('')
  const [note, setNote] = useState(seedNote)
  const [activeStarter, setActiveStarter] = useState(seedKey)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [handoff, setHandoff] = useState(null) // set once created → share stage
  const [copied, setCopied] = useState(false)

  const inviteUrl = handoff?.token
    ? `${window.location.origin}/invite/${handoff.token}`
    : ''

  function applyStarter(starter) {
    setActiveStarter(starter.key)
    setNote(starter.note)
  }

  async function send() {
    setError('')
    setSending(true)
    try {
      const { data } = await handoffRecipe(recipeId, {
        to_email: email.trim() || null,
        note: note.trim() || null,
      })
      setHandoff(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  async function share() {
    const text = note.trim()
      ? `${note.trim()}\n\n${inviteUrl}`
      : `I want you to have this recipe for ${recipeName}: ${inviteUrl}`
    // Native share sheet where available (mobile); clipboard fallback elsewhere.
    if (navigator.share) {
      try {
        await navigator.share({ title: `${recipeName} — issei`, text })
        return
      } catch {
        // user dismissed the sheet, or share failed — fall through to copy
      }
    }
    copy()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  // ---- STAGE 2: share the link ----
  if (handoff) {
    return (
      <div className="px-[18px] py-6 text-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mint border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24]">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-8 h-8">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#2E3A24"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="font-display font-black text-[26px] text-ink leading-tight mt-5">
          Ready to send
        </h1>
        <p className="font-display italic text-[14px] text-ink-soft mt-2 mb-5">
          Send them this link — they&rsquo;ll see {recipeName} and can keep it.
        </p>

        {/* the link itself, visible so it never feels like nothing happened */}
        <p className="sticker bg-card px-3 py-2.5 font-mono text-[11.5px] text-ink-soft break-all text-left mb-4">
          {inviteUrl}
        </p>

        <button onClick={share} className="btn-primary">
          Share the link
        </button>
        <button
          onClick={copy}
          className="w-full mt-3 py-2.5 rounded-full bg-cream border-2 border-ink text-ink font-display font-bold text-[14px] shadow-[0_3px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24]"
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>

        {error && (
          <p className="mt-3">
            <span className="error-pill">{error}</span>
          </p>
        )}

        {email.trim() && (
          <p className="font-display italic text-[12.5px] text-ink-soft mt-4">
            When {email.trim()} signs up, this recipe will be waiting for them.
          </p>
        )}

        <button
          onClick={() => onSent?.(handoff)}
          className="block w-full mt-4 font-display italic text-ink-soft text-sm"
        >
          Done
        </button>
      </div>
    )
  }

  // ---- STAGE 1: compose ----
  return (
    <div className="px-[18px] py-6 text-center">
      <h1 className="font-display font-black text-[26px] text-ink leading-tight">
        Who else should
        <br />
        have this recipe?
      </h1>
      <p className="font-display italic text-[14px] text-ink-soft mt-2 mb-5">
        {recipeVisibility === 'public'
          ? 'Let them know about this — it’s already public.'
          : 'You’ll get a link to send them. They’ll be able to cook it and keep it — and add the parts only they know.'}
      </p>
      <div className="flex gap-2 mb-2.5">
        {HANDOFF_STARTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => applyStarter(s)}
            aria-pressed={activeStarter === s.key}
            className={`flex-1 text-[12.5px] font-display font-bold rounded-full px-3 py-2 border-2 border-ink transition-colors ${
              activeStarter === s.key
                ? 'bg-terra text-cream'
                : 'bg-cream text-ink-soft'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        placeholder="A note in your words… (optional)"
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setActiveStarter(null)
        }}
        rows={2}
        className="field resize-none mb-3"
      />
      <input
        type="email"
        placeholder="Their email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="field mb-1.5"
      />
      <p className="font-display italic text-[12px] text-ink-soft mb-3">
        Add their email and the recipe will be waiting when they sign up.
      </p>
      {error && (
        <p className="mb-3">
          <span className="error-pill">{error}</span>
        </p>
      )}
      <button
        onClick={send}
        disabled={sending}
        className="btn-primary disabled:opacity-50"
      >
        {sending ? 'Getting your link…' : 'Pass it on'}
      </button>
      <button
        onClick={onSkip}
        className="block w-full mt-3 font-display italic text-ink-soft text-sm"
      >
        Skip for now
      </button>
    </div>
  )
}
