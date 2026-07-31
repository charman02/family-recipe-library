import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
  localStorage.setItem(
    'issei_user',
    JSON.stringify({ id: 1, first_name: 'Yoko', email: 'yoko@example.com' }),
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
