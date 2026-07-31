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

  // `isNew` is what separates the two callers: only handleSignup passes it, so a
  // returning sign-in can never trip the welcome no matter how empty their
  // kitchen looks. The alternative — inferring "new" from having no recipes —
  // would re-teach anyone who signed up and hasn't kept a dish yet, every single
  // time they came back.
  async function finishAuth(data, { isNew = false } = {}) {
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
    // An invite recipient is deliberately exempt even when brand new: they have
    // just scrolled a real recipe on /invite/:token and signed up to keep that
    // one dish. A tutorial standing between them and it would be the app talking
    // over the thing it's trying to explain — and Home leads with their recipe,
    // which teaches it better than any panel.
    const destination = isNew && !inviteToken ? '/welcome' : '/'
    // REPLACE, not push: a pushed entry leaves /login sitting behind Home, so the
    // first thing a new user does — swipe/press back — lands them on the sign-in
    // screen while already signed in. Replacing drops it from history entirely.
    navigate(destination, { replace: true })
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
      await finishAuth(data, { isNew: true })
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
      {/* One line, and only one. The explaining moved to /welcome after signup:
          a sign-in screen's job is to get a returning user past it, and an
          earlier pass that stacked a pitch, a sample recipe and a glossary here
          made the form itself something you had to scroll to reach. This line
          stays because a wordmark alone leaves a first-time visitor with no idea
          what they're signing into. */}
      <p className="font-display italic text-[16px] leading-snug text-ink-soft mb-7 text-center max-w-[19rem]">
        For the dish someone cooked you that you&rsquo;d never had before.
      </p>

      {inviteToken && (
        /* COLD INVITE RECIPIENT — they arrive here having just read a real
           recipe on /invite/:token, so they already know what the app is. What
           they need is the thread back to the dish they were reading, not a
           general introduction. (They skip /welcome after signup too, for the
           same reason — see finishAuth.) */
        <div className="w-full max-w-sm mb-7 sticker bg-peach px-5 py-4 text-center">
          <p className="font-display font-black text-[17px] leading-tight text-ink">
            One more step to keep that recipe.
          </p>
          <p className="font-display text-[13.5px] leading-snug text-ink-soft mt-1.5">
            Make an account and it&rsquo;s yours — in your kitchen, for good.
          </p>
        </div>
      )}

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
