import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/lineage', () => ({ claimInvite: vi.fn() }))
import { claimInvite } from '../api/lineage'
import PublicOnlyRoute from './PublicOnlyRoute'

beforeEach(() => {
  localStorage.clear()
  claimInvite.mockReset()
})

// Render the guard inside a router that also has landing routes, so a redirect
// is observable as "which screen you end up on" rather than as a mock call.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <div>sign-in form</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/" element={<div>your kitchen</div>} />
        <Route path="/shared" element={<div>shared with you</div>} />
        <Route path="/recipes/:id" element={<div>recipe page</div>} />
        <Route path="/invite/:token" element={<div>invite preview</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicOnlyRoute', () => {
  it('signed out → renders the sign-in form', () => {
    renderAt('/login')
    expect(screen.getByText('sign-in form')).toBeInTheDocument()
  })

  it('signed in → redirects to the kitchen instead of showing sign-in', async () => {
    localStorage.setItem('issei_token', 'tok')
    renderAt('/login')
    expect(await screen.findByText('your kitchen')).toBeInTheDocument()
    expect(screen.queryByText('sign-in form')).toBeNull()
  })

  it('signed in with an invite token → claims it, never discards it', async () => {
    // The crux: bouncing an already-signed-in recipient to / would throw the
    // token away and they'd never receive the handed-off recipe.
    localStorage.setItem('issei_token', 'tok')
    claimInvite.mockResolvedValue({ data: { id: 9, recipe_id: 42 } })
    renderAt('/login?tab=signup&invite=abc123')
    await waitFor(() => expect(claimInvite).toHaveBeenCalledWith('abc123'))
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })

  it('signed in with an invite token → does not flash the sign-in form', () => {
    localStorage.setItem('issei_token', 'tok')
    claimInvite.mockReturnValue(new Promise(() => {}))
    renderAt('/login?tab=signup&invite=abc123')
    expect(screen.queryByText('sign-in form')).toBeNull()
    expect(screen.getByText('Opening…')).toBeInTheDocument()
  })

  it('claim response without a recipe_id → lands on the shared list', async () => {
    localStorage.setItem('issei_token', 'tok')
    claimInvite.mockResolvedValue({ data: { id: 9, state: 'accepted' } })
    renderAt('/login?invite=abc123')
    expect(await screen.findByText('shared with you')).toBeInTheDocument()
  })

  it('failed claim → falls back to the invite preview, not a dead end', async () => {
    localStorage.setItem('issei_token', 'tok')
    claimInvite.mockRejectedValue({ response: { status: 500 } })
    renderAt('/login?invite=abc123')
    expect(await screen.findByText('invite preview')).toBeInTheDocument()
  })

  it('signed OUT with an invite token → sign-in form, claim left to Login', () => {
    // Login owns the sign-out claim path (it claims inside finishAuth); the guard
    // must not try to claim without a session or the request 401s.
    renderAt('/login?tab=signup&invite=abc123')
    expect(screen.getByText('sign-in form')).toBeInTheDocument()
    expect(claimInvite).not.toHaveBeenCalled()
  })
})
