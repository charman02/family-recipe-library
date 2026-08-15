import { useState } from 'react'
import { Link } from 'react-router-dom'
import client, { toUserMessage } from '../api/client'
import IconField from '../components/IconField'
import Wordmark from '../components/Wordmark'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await client.post('/auth/forgot-password', { email })
      setSubmitted(true)
    } catch (err) {
      setError(toUserMessage(err, "Something went wrong. Try again?"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center mb-4">
        <h1>
          <Wordmark size="lg" />
        </h1>
      </div>

      <div className="w-full max-w-sm">
        {submitted ? (
          <div className="text-center">
            <div className="sticker bg-peach px-5 py-6 mb-6">
              <p className="font-display font-black text-[18px] text-ink mb-2">
                Check your inbox
              </p>
              <p className="font-display text-[14px] text-ink-soft leading-snug">
                If that email has an account, a reset link is on its way. It
                expires in one hour.
              </p>
            </div>
            <Link
              to="/login"
              className="font-display font-bold text-[14px] text-terra underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display font-black text-[22px] text-ink mb-1">
              Forgot your password?
            </h2>
            <p className="font-display italic text-[14px] text-ink-soft mb-6">
              Enter your email and we&rsquo;ll send you a reset link.
            </p>

            {error && (
              <p className="mb-4 text-center">
                <span className="error-pill">{error}</span>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <IconField
                icon="mail"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="field--login"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary !mt-4"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center font-display text-[13px] text-ink-soft pt-4">
              <Link
                to="/login"
                className="font-bold text-terra underline underline-offset-2"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
