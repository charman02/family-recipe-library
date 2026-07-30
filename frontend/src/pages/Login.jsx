import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { claimInvite } from '../api/lineage'
import IconField from '../components/IconField'

export default function Login() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [tab, setTab] = useState(
    searchParams.get('tab') === 'signup' ? 'signup' : 'login',
  )
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function switchTab(next) {
    setTab(next)
    setError('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFirstName('')
    setLastName('')
  }

  async function finishAuth(data) {
    localStorage.setItem('issei_token', data.access_token)
    localStorage.setItem('issei_user', JSON.stringify(data.user))
    if (inviteToken) {
      // The token IS the authorization; claim the grant for this account, then
      // land the user on the recipe they were invited to.
      try {
        await claimInvite(inviteToken)
      } catch {
        // A bad/expired token shouldn't block sign-in; just proceed home.
      }
    }
    // REPLACE, not push: a pushed entry leaves /login sitting behind Home, so the
    // first thing a new user does — swipe/press back — lands them on the sign-in
    // screen while already signed in. Replacing drops it from history entirely.
    navigate('/', { replace: true })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data } = await client.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      await finishAuth(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await client.post('/auth/signup', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      })
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data } = await client.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      await finishAuth(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      {/* Wordmark — kept clean & classy, no ornamentation. */}
      <div className="text-center mb-2">
        <h1 className="font-display font-black text-[52px] leading-none tracking-[-0.01em] text-ink">
          issei<span className="text-terra">.</span>
        </h1>
      </div>
      <p className="font-display italic text-[16px] text-ink-soft mb-7 text-center max-w-xs">
        Recipes that live in memory, not cookbooks.
      </p>

      {/* The meaning of the name — a peach sticker card. One small pop of color:
          a coral heart stamp straddling the corner (heritage/heart, not a repeat
          of the Home dish discs). */}
      <div className="relative w-full max-w-sm mb-8 sticker bg-peach p-5">
        <span
          aria-hidden="true"
          className="absolute -top-3 -right-3 flex items-center justify-center w-10 h-10 rounded-full bg-coral border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] rotate-12"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path
              d="M12 20s-7-4.6-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.4 12 20 12 20Z"
              fill="#FCF8EE"
              stroke="#2E3A24"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="inline-block font-display font-black text-[13px] text-ink bg-cream border-2 border-ink rounded-full px-3 py-1 -rotate-2 shadow-[0_2px_0_#2E3A24] mb-3">
          一世 · issei
        </span>
        <p className="font-display italic text-[15px] leading-relaxed text-ink">
          The first of a family to arrive somewhere new — the ones who carry the
          recipes no one wrote down. This is where they stay alive, passed from
          one generation to the next.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex bg-cream border-2 border-ink rounded-full p-1 mb-6">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 rounded-full font-display font-bold text-sm transition-colors ${
              tab === 'login' ? 'bg-terra text-cream' : 'text-ink-soft'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchTab('signup')}
            className={`flex-1 py-2 rounded-full font-display font-bold text-sm transition-colors ${
              tab === 'signup' ? 'bg-terra text-cream' : 'text-ink-soft'
            }`}
          >
            Open your kitchen
          </button>
        </div>

        {error && (
          <p className="mb-4 text-center">
            <span className="error-pill">{error}</span>
          </p>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <IconField
              icon="mail"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="field--login"
            />
            <IconField
              icon="lock"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field--login"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary !mt-4"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {/* No self-serve reset yet (small trusted launch) — point locked-out
                users to email. Replace with a real flow post-launch. */}
            <p className="text-center font-display text-[13px] text-ink-soft pt-1">
              Forgot your password?{' '}
              <a
                href="mailto:charlie0309@me.com?subject=issei%20password%20help"
                className="font-bold text-terra underline underline-offset-2"
              >
                Email me
              </a>{' '}
              and I&rsquo;ll get you back in. 💛
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="field field--login"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="field field--login"
            />
            <IconField
              icon="mail"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="field--login"
            />
            <IconField
              icon="lock"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field--login"
            />
            <IconField
              icon="lock"
              type="password"
              placeholder="Confirm password"
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
              {loading ? 'Setting up…' : 'Open your kitchen'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
