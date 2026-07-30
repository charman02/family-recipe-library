import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { post: vi.fn() } }))
import client from '../api/client'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
import Login from './Login'

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
  client.post.mockReset()
})

describe('Login', () => {
  it('REPLACES history on sign-in so back does not return to /login', async () => {
    // The bug this guards: a pushed entry left /login behind Home, so the very
    // first back gesture a new user made showed them the sign-in screen while
    // already signed in — which reads as "back is broken".
    client.post.mockResolvedValue({
      data: { access_token: 'tok', user: { id: 1, first_name: 'Charlie' } },
    })
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'pw123456' },
    })
    // both the tab and the submit read "Sign in", so submit the form itself
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    )
  })

  it('uses kitchen signup copy, not the cookbook "Join the table"', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    // On the Sign In tab, only the signup TAB button reads "Open your kitchen"
    // (the submit button reads "Sign in"), so this is unambiguous.
    expect(
      screen.getByRole('button', { name: /open your kitchen/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /join the table/i }),
    ).not.toBeInTheDocument()
  })

  it('clears fields when switching Sign In ↔ signup', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    // type an email on the Sign In tab
    const email = screen.getByPlaceholderText('Email')
    fireEvent.change(email, { target: { value: 'stale@example.com' } })
    expect(email).toHaveValue('stale@example.com')
    // switch to signup (click the signup tab), then back to Sign In
    fireEvent.click(
      screen.getByRole('button', { name: /open your kitchen/i }),
    )
    // now on signup: TWO buttons read "open your kitchen" (tab + submit).
    // Return to Sign In via its tab.
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    // the email field is a fresh empty field
    expect(screen.getByPlaceholderText('Email')).toHaveValue('')
  })
})
