import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import client, { toUserMessage } from '../api/client'
import IconField from '../components/IconField'
import Wordmark from '../components/Wordmark'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.")
      return
    }

    setLoading(true)
    try {
      await client.post('/auth/reset-password', { token, new_password: password })
      navigate('/login?reset=1', { replace: true })
    } catch (err) {
      setError(toUserMessage(err, 'This reset link is invalid or has expired.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm sticker bg-peach px-5 py-6 text-center">
          <p className="font-display font-black text-[17px] text-ink mb-1">
            Invalid reset link
          </p>
          <p className="font-display text-[13.5px] text-ink-soft">
            Request a new one from the sign-in page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center mb-4">
        <h1>
          <Wordmark size="lg" />
        </h1>
      </div>

      <div className="w-full max-w-sm">
        <h2 className="font-display font-black text-[22px] text-ink mb-1">
          Set a new password
        </h2>
        <p className="font-display italic text-[14px] text-ink-soft mb-6">
          At least 8 characters.
        </p>

        {error && (
          <p className="mb-4 text-center">
            <span className="error-pill">{error}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <IconField
            icon="lock"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="field--login"
          />
          <IconField
            icon="lock"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="field--login"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary !mt-4"
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
