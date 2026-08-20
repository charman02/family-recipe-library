import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import BackButton from './BackButton'

// A tiny probe that renders the current path + location.key, so a test can assert WHERE
// Back landed and whether it popped real history vs. used the fallback.
function Here() {
  const loc = useLocation()
  return <div data-testid="here">{loc.pathname}</div>
}

// The three entry points a multiply-reachable page (e.g. /friends) can be opened from,
// wired so a click on a source link navigates into /sub with real history behind it.
function Harness({ to }) {
  return (
    <Routes>
      <Route path="/" element={<div><a href="/feed-src">to feed src</a></div>} />
      <Route
        path="/feed"
        element={
          <>
            <NavLinkTo path="/sub" label="open sub from feed" />
            <Here />
          </>
        }
      />
      <Route
        path="/you"
        element={
          <>
            <NavLinkTo path="/sub" label="open sub from you" />
            <Here />
          </>
        }
      />
      <Route
        path="/sub"
        element={
          <>
            <BackButton to={to} label="Back" />
            <Here />
          </>
        }
      />
    </Routes>
  )
}

// A button that navigates (so it pushes a real history entry, unlike an initial render).
import { useNavigate } from 'react-router-dom'
function NavLinkTo({ path, label }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(path)}>{label}</button>
}

beforeEach(() => {})

describe('BackButton (#76 — returns to the previous page, not a fixed tab)', () => {
  it('pops real history when the user came from another in-app screen', async () => {
    // Start on /feed, navigate to /sub (real history), then Back → should return to /feed,
    // NOT the hardcoded fallback.
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Harness to="/you" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /open sub from feed/i }))
    expect(screen.getByTestId('here')).toHaveTextContent('/sub')
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    // Landed back on /feed — the actual previous page — even though the fallback is /you.
    expect(screen.getByTestId('here')).toHaveTextContent('/feed')
  })

  it('returns to whichever screen you actually came from (not a single fixed one)', async () => {
    // The same page, entered from /you this time, must go back to /you.
    render(
      <MemoryRouter initialEntries={['/you']}>
        <Harness to="/feed" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /open sub from you/i }))
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByTestId('here')).toHaveTextContent('/you')
  })

  it('uses the `to` fallback on a cold entry (no in-app history to pop)', async () => {
    // Land directly on /sub (a shared link / fresh tab): location.key === 'default', so
    // there's nothing to pop — Back uses the fallback instead of doing nothing.
    render(
      <MemoryRouter initialEntries={['/sub']}>
        <Harness to="/you" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByTestId('here')).toHaveTextContent('/you')
  })

  it('falls back to Home when cold-entered with no `to` given', async () => {
    render(
      <MemoryRouter initialEntries={['/sub']}>
        <Routes>
          <Route path="/" element={<Here />} />
          <Route path="/sub" element={<><BackButton label="Back" /><Here /></>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByTestId('here')).toHaveTextContent('/')
  })

  it('lets `onClick` fully override (multi-step in-page flows step through their own state)', async () => {
    let called = false
    render(
      <MemoryRouter initialEntries={['/sub']}>
        <Routes>
          <Route
            path="/sub"
            element={<BackButton to="/you" onClick={() => (called = true)} label="Back" />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(called).toBe(true)
  })
})
