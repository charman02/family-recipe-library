import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { sendFeedback } from '../api/feedback'
import { toUserMessage } from '../api/client'
import BackButton from '../components/BackButton'
import MarkerTitle from '../components/MarkerTitle'

// Send a note about the app, without leaving it.
//
// This replaces the external hosted form the launch shipped (VITE_FEEDBACK_URL).
// Two things made that form lose reports, and both are design constraints here:
// leaving the app to fill one in is where most people stopped, and an answer
// arrived as anonymous prose, so acting on "the button didn't work" meant finding
// the sender and asking them which screen and which build.
//
// The body cap matches the backend's 2000 exactly. Kept in lockstep on purpose:
// if this were looser, a long report would be typed in full and then rejected on
// send, which is the worst possible moment to lose it.
const MAX_BODY = 2000
// Start counting down only near the end. A counter on an empty box reads as a
// length requirement and makes a one-line report feel insufficient — the opposite
// of what this form wants.
const COUNTER_FROM = 1800

export default function Feedback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // The screen the sender came from, handed over by the link that opened this
  // page. Read from router state rather than sniffed, so it can only ever be a
  // route the person navigated to themselves — and the disclosure line below says
  // it's included.
  const cameFrom = location.state?.from || null
  const appVersion = import.meta.env.VITE_APP_VERSION

  const remaining = MAX_BODY - body.length

  async function submit(e) {
    e.preventDefault()
    // Mirrors the server's rule (trim, then require one character) so a
    // spacebar-only note is answered instantly instead of by a round trip.
    if (!body.trim()) {
      setError('Add a few words first, then send.')
      return
    }
    setError('')
    setSending(true)
    try {
      await sendFeedback({ body, path: cameFrom, appVersion })
      setSent(true)
    } catch (err) {
      // Through the central normalizer, like every other form here: FastAPI
      // answers a schema failure with `detail` as an array of objects, which put
      // "[object Object]" on screen once already.
      setError(toUserMessage(err, "Couldn't send your note. Try again."))
    } finally {
      setSending(false)
    }
  }

  // ---- SENT — confirm loudly. A feedback form that silently succeeds teaches
  // people it went nowhere, and they stop sending them.
  if (sent) {
    return (
      <div className="min-h-screen bg-cream px-5 pt-6">
        {/* role=status so the confirmation is announced, not just drawn — this
            view replaces the form outright, so a screen reader user would
            otherwise get no signal that anything happened. */}
        <div role="status" className="sticker bg-sage p-6 mt-6 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cream border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24]">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-7 h-7">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#2E3A24"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="font-display font-black text-[26px] text-ink leading-tight mt-4">
            Got it — thank you
          </h1>
          <p className="font-display italic text-[14.5px] text-ink-soft mt-2">
            Your note is saved. Notes like this are how the rough edges get
            found.
          </p>
        </div>

        <button
          onClick={() => {
            setBody('')
            setSent(false)
          }}
          className="btn-primary mt-6"
        >
          Send another note
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="w-full py-3 mt-3 rounded-full bg-cream border-[2.5px] border-ink text-terra font-display font-bold text-[14px] shadow-[0_4px_0_#2E3A24] transition-transform active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24]"
        >
          Back to you
        </button>
      </div>
    )
  }

  // ---- COMPOSE
  return (
    <div className="min-h-screen bg-cream px-5 pt-5">
      <div className="mb-5">
        <BackButton to="/profile" label="Back" />
      </div>

      <MarkerTitle
        color="bg-saffron"
        className="font-display font-black text-[30px] text-ink leading-none"
      >
        Tell us<span className="text-terra">.</span>
      </MarkerTitle>
      {/* Names both halves of what's wanted. "Feedback" on its own gets bug
          reports only, and the wishes are the more useful half during a beta. */}
      <p className="font-display italic text-[15px] text-ink-soft mt-3 mb-5">
        Anything that broke, confused you, or that you wish this did. Half a
        sentence is plenty.
      </p>

      <form onSubmit={submit} className="sticker bg-card p-5">
        {/* A real <label>, so tapping the words focuses the box and the field has
            an accessible name without a placeholder standing in for one —
            placeholders vanish on the first keystroke. */}
        <label htmlFor="feedback-body" className="section-label block mb-2">
          Your note
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={MAX_BODY}
          autoFocus
          aria-describedby="feedback-context"
          // Marks the field itself as the thing that failed, so a screen reader
          // reaching it hears the problem rather than only the pill above.
          aria-invalid={error ? true : undefined}
          placeholder="What happened, or what you wish this did…"
          className="field resize-none"
        />

        {remaining <= MAX_BODY - COUNTER_FROM && (
          // Words, not a bare number and not a colour change: "180 characters
          // left" is readable to everyone, including at 0.
          <p className="font-sans text-[12px] text-ink-soft mt-1.5">
            {remaining} characters left.
          </p>
        )}

        {/* The privacy note, in the form rather than buried in a policy — this is
            the whole of what gets sent besides the words, and saying it here is
            what keeps the extra fields from being a surprise. Rendered even when
            a field is absent, because "which screen you came from" is true of the
            attempt regardless. */}
        <p
          id="feedback-context"
          className="font-display italic text-[12.5px] text-ink-soft mt-3"
        >
          Sent with your note: your account, the screen you came from, and which
          version of the app you&rsquo;re on. Nothing else.
        </p>

        {error && (
          <p className="mt-3" role="alert">
            <span className="error-pill">{error}</span>
          </p>
        )}

        <button type="submit" disabled={sending} className="btn-primary mt-4">
          {sending ? 'Sending…' : 'Send note'}
        </button>
      </form>
    </div>
  )
}
