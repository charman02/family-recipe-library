import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
// Account edits go through client.patch('/auth/me'); toUserMessage passes through
// the real formatter's behavior for the error test.
vi.mock('../api/client', () => ({
  default: { patch: vi.fn() },
  toUserMessage: (err, fallback) =>
    err?.response?.data?.detail || fallback,
}))
import client from '../api/client'
import Profile from './Profile'

// Covers the settings copy: round-2 testers read "Reduce motion" as jargon and
// "Cooking mode" as a name for a screen they hadn't met, so both toggles now say
// what changes. The stored pref keys are unchanged — this is a label pass, and
// these tests pin that the rename didn't quietly repoint the storage.
function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
  client.patch.mockReset()
  localStorage.setItem(
    'issei_user',
    JSON.stringify({
      id: 1,
      first_name: 'Yoko',
      last_name: 'M',
      email: 'yoko@example.com',
    }),
  )
})

describe('Profile settings copy', () => {
  it('describes the motion toggle in plain language, not "reduce motion"', () => {
    renderProfile()
    expect(screen.getByText('Turn off animations')).toBeInTheDocument()
    expect(
      screen.getByText(/appear right away instead of sliding or fading/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/reduce motion/i)).toBeNull()
  })

  it('names the steps-only preference the same way the recipe toggle does', () => {
    renderProfile()
    // Mirrors RecipeBody's toggle verbatim. "Just the steps" was retired because
    // it was a lie — that view shows the ingredients too — and this setting has to
    // be renamed in lockstep or it describes a button that no longer exists.
    expect(screen.getByText(/ingredients & steps/i)).toBeInTheDocument()
    expect(screen.queryByText(/just the steps/i)).toBeNull()
    expect(
      screen.getByText(/straight to ingredients and steps/i),
    ).toBeInTheDocument()
    // "Cooking mode" was the undecodable label; it must not survive anywhere.
    expect(screen.queryByText(/cooking mode/i)).toBeNull()
  })

  it('still persists under the original pref keys after the rename', async () => {
    renderProfile()
    await userEvent.click(
      screen.getByRole('switch', { name: /turn off animations/i }),
    )
    expect(JSON.parse(localStorage.getItem('issei_prefs'))).toEqual({
      reduceMotion: true,
    })
  })
})

describe('Profile feedback entry point', () => {
  it('opens the in-app form rather than leaving for an external one', async () => {
    // The launch shipped an <a> to a Google Form. Leaving the app is where most
    // testers stopped, so this is now an in-app route.
    renderProfile()
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/feedback', {
      state: { from: '/profile' },
    })
  })

  it('passes the originating screen so a report says where it came from', async () => {
    // Handed over explicitly rather than sniffed, so it can only ever be a route
    // the person navigated to themselves — which is what the form discloses.
    renderProfile()
    await userEvent.click(screen.getByRole('button', { name: /send feedback/i }))
    expect(mockNavigate.mock.calls[0][1].state.from).toBe('/profile')
  })

  it('no longer renders an external feedback link', () => {
    // Guards the removal of VITE_FEEDBACK_URL. A leftover outbound link would
    // split reports between a spreadsheet and the database, and a stale env var on
    // the deploy host would silently keep sending people out of the app.
    // queryAll, not getAll: the removal means there is no anchor left to find at
    // all, and getAllByRole throws on zero matches rather than returning [].
    const { container } = renderProfile()
    const outbound = [...container.querySelectorAll('a[href]')].map((a) =>
      a.getAttribute('href'),
    )
    expect(outbound.filter((h) => /forms\.gle|tally|https?:/i.test(h))).toEqual([])
    // And specifically not an <a> wearing the feedback label.
    expect(screen.queryByRole('link', { name: /send feedback/i })).toBeNull()
  })

  it('always offers the feedback entry point, with no env var to configure', () => {
    // The old button hid itself unless VITE_FEEDBACK_URL was set, so an unset var
    // meant no way to report anything at all. An in-app route can't point at
    // nothing, so it is unconditional.
    renderProfile()
    expect(
      screen.getByRole('button', { name: /send feedback/i }),
    ).toBeInTheDocument()
  })
})

describe('Profile account editing', () => {
  it('replaces the old "Soon" placeholders with working editors', () => {
    renderProfile()
    // The three rows exist as real controls now, not disabled "Soon" badges.
    expect(screen.getByRole('button', { name: /edit name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change email/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /change password/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^soon$/i)).toBeNull()
  })

  it('saves a new name via PATCH /auth/me and refreshes the cached user', async () => {
    client.patch.mockResolvedValue({
      data: { first_name: 'Yoko', last_name: 'Ono', email: 'yoko@example.com' },
    })
    renderProfile()
    await userEvent.click(screen.getByRole('button', { name: /edit name/i }))
    const last = screen.getByLabelText('Last name')
    await userEvent.clear(last)
    await userEvent.type(last, 'Ono')
    await userEvent.click(screen.getByRole('button', { name: /save name/i }))

    expect(client.patch).toHaveBeenCalledWith('/auth/me', {
      first_name: 'Yoko',
      last_name: 'Ono',
    })
    // localStorage now reflects the server's response.
    expect(JSON.parse(localStorage.getItem('issei_user')).last_name).toBe('Ono')
    expect(await screen.findByText(/your name is updated/i)).toBeInTheDocument()
  })

  it('sends the current password when changing email', async () => {
    client.patch.mockResolvedValue({
      data: { first_name: 'Yoko', last_name: 'M', email: 'new@example.com' },
    })
    renderProfile()
    await userEvent.click(screen.getByRole('button', { name: /change email/i }))
    const email = screen.getByLabelText('New email')
    await userEvent.clear(email)
    await userEvent.type(email, 'new@example.com')
    await userEvent.type(screen.getByLabelText('Current password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /save email/i }))

    expect(client.patch).toHaveBeenCalledWith('/auth/me', {
      email: 'new@example.com',
      current_password: 'password123',
    })
    expect(JSON.parse(localStorage.getItem('issei_user')).email).toBe(
      'new@example.com',
    )
  })

  it('surfaces the server error (e.g. wrong current password) without crashing', async () => {
    client.patch.mockRejectedValue({
      response: { data: { detail: "Your current password isn't right." } },
    })
    renderProfile()
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))
    await userEvent.type(screen.getByLabelText('Current password'), 'wrong')
    await userEvent.type(
      screen.getByLabelText('New password'),
      'a-new-password',
    )
    await userEvent.click(screen.getByRole('button', { name: /save password/i }))
    expect(
      await screen.findByText(/current password isn.t right/i),
    ).toBeInTheDocument()
  })
})
