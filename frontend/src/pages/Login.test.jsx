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

  it('keeps ONE orienting line and nothing more', async () => {
    // A first-time visitor still needs to know what they're signing into, so the
    // tagline stays. Everything that used to sit under it now runs after signup
    // at /welcome — see Welcome.test.jsx.
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/someone cooked you that you.d never had before/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/not a scrubbed list of grams/i),
    ).not.toBeInTheDocument()
  })

  it('no longer buries the form under a sample recipe and a glossary', async () => {
    // The regression this guards: an earlier pass stacked a pitch card, a sample
    // recipe and the 一世 gloss above the fields, so a returning user had to
    // scroll past an explanation they'd already read to sign in.
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
    expect(screen.queryByText('their way')).not.toBeInTheDocument()
    expect(screen.queryByText(/colour of tea/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/一世 · issei/)).not.toBeInTheDocument()
  })

  it('sends a NEW signup to the welcome, and a returning sign-in straight home', async () => {
    // The whole point of threading `isNew` through finishAuth: "empty kitchen"
    // is not the same as "new account", so only signup may trigger the intro.
    client.post.mockResolvedValue({
      data: { access_token: 'tok', user: { id: 1, first_name: 'Mia' } },
    })
    const { unmount } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open your kitchen/i }))
    fireEvent.change(screen.getByPlaceholderText('First name'), {
      target: { value: 'Mia' },
    })
    fireEvent.change(screen.getByPlaceholderText('Last name'), {
      target: { value: 'Tan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'pw123456' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'pw123456' },
    })
    fireEvent.submit(screen.getByPlaceholderText('Confirm password').closest('form'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/welcome', { replace: true }),
    )
    unmount()

    // Same credentials, sign-in tab: no welcome.
    mockNavigate.mockClear()
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
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith('/welcome', { replace: true })
  })

  it('claims nothing about voice or audio', async () => {
    // There is no audio in the product; Step.voice_note is typed text.
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/\bvoice\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|audio|listen/i)).not.toBeInTheDocument()
  })

  it('gives an invite recipient the continuation line, not a general intro', async () => {
    // Arriving with ?invite=, this person has just scrolled someone's actual
    // recipe. What they need is the thread back to that dish.
    render(
      <MemoryRouter initialEntries={['/login?tab=signup&invite=abc123']}>
        <Login />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/one more step to keep that recipe/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/in your kitchen, for good/i),
    ).toBeInTheDocument()
  })

  it('claims the invite and skips the welcome — their recipe explains itself', async () => {
    // A tutorial between this person and the dish they signed up for would be
    // the app talking over the thing it is trying to explain. Home leads with
    // their recipe instead.
    client.post.mockResolvedValue({
      data: { access_token: 'tok', user: { id: 1 }, recipe_id: 9 },
    })
    render(
      <MemoryRouter initialEntries={['/login?tab=signup&invite=abc123']}>
        <Login />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText('First name'), {
      target: { value: 'Mia' },
    })
    fireEvent.change(screen.getByPlaceholderText('Last name'), {
      target: { value: 'Tan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'pw123456' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'pw123456' },
    })
    fireEvent.submit(
      screen.getByPlaceholderText('Confirm password').closest('form'),
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    )
    expect(client.post).toHaveBeenCalledWith('/recipes/invite/abc123/claim')
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
