import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Welcome from './Welcome'

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// "Seen" is recorded per user id, so a signed-in user has to exist for any of
// this to mean anything — that scoping is what stops the second person to sign up
// on a shared phone from being silently skipped.
function signIn(id = 7) {
  localStorage.setItem('issei_user', JSON.stringify({ id, first_name: 'Charlie' }))
}

beforeEach(() => {
  localStorage.clear()
  signIn()
})

describe('Welcome — what it teaches', () => {
  it('shows what the app is for by SHOWING a recipe, then names itself', async () => {
    renderWelcome()
    expect(screen.getByText(/their way\./)).toBeInTheDocument()
    // Deliberately terse: the owner cut this panel's paragraph, because a new
    // user shouldn't have to read prose to learn what the app is. The sample
    // card below is the evidence, so the words only have to point at it.
    expect(screen.getByText(/not grams\. theirs\./i)).toBeInTheDocument()
    // The sample card — a folk amount kept verbatim, badged as theirs, plus the
    // remark that carries the knowledge an ingredient list can't hold.
    expect(screen.getByText('3 soup spoons')).toBeInTheDocument()
    expect(screen.getByText('their way')).toBeInTheDocument()
    expect(screen.getByText(/colour of tea/i)).toBeInTheDocument()
    // The gloss, on the same panel but last.
    expect(screen.getByText(/一世 · issei/)).toBeInTheDocument()
  })

  it('covers the second half — how to actually use it', async () => {
    renderWelcome()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Keep a recipe')).toBeInTheDocument()
    expect(screen.getByText('Send it to someone')).toBeInTheDocument()
    // The instruction names the control the user will actually find on the
    // recipe page, verbatim — a paraphrase would send them hunting.
    expect(
      screen.getByText(/Send this to someone/),
    ).toBeInTheDocument()
  })

  it('is two panels — not a carousel', async () => {
    renderWelcome()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    // The second panel's button leaves; there is no third.
    expect(
      screen.queryByRole('button', { name: /next/i }),
    ).not.toBeInTheDocument()
  })

  it('claims nothing about voice or audio', async () => {
    // There is no audio in the product: Step.voice_note is a TEXT column typed by
    // whoever recorded the recipe.
    renderWelcome()
    expect(screen.queryByText(/\bvoice\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|audio|listen/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.queryByText(/\bvoice\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|audio|listen/i)).not.toBeInTheDocument()
  })

  it('never suggests you can edit a recipe someone sent you', async () => {
    // Verified false: PATCH /recipes/{id} filters on user_id, so a granted
    // non-owner cannot edit.
    renderWelcome()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument()
  })
})

describe('Welcome — shows exactly once', () => {
  it('marks itself seen on arrival, before any button is pressed', async () => {
    renderWelcome()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    // Closing the tab here must be as final as finishing, so the flag is written
    // on mount rather than on exit.
    expect(JSON.parse(localStorage.getItem('issei_prefs')).welcomeSeenBy).toEqual([
      7,
    ])
  })

  it('skipping is as final as completing — a second visit redirects home', async () => {
    const { unmount } = renderWelcome()
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(await screen.findByText('home')).toBeInTheDocument()
    unmount()

    renderWelcome()
    expect(await screen.findByText('home')).toBeInTheDocument()
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument()
  })

  it('completing also persists, and lands on Home', async () => {
    const { unmount } = renderWelcome()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(
      screen.getByRole('button', { name: /open my kitchen/i }),
    )
    expect(await screen.findByText('home')).toBeInTheDocument()
    unmount()

    renderWelcome()
    expect(await screen.findByText('home')).toBeInTheDocument()
  })

  it('panel two can go BACK to panel one', async () => {
    // A forward-only intro means one mistaken tap costs the explanation for good,
    // since the welcome never runs again.
    renderWelcome()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByText(/not grams\. theirs\./i)).toBeInTheDocument()
  })

  it('skip is reachable from BOTH panels, so nobody is stranded on panel two', async () => {
    renderWelcome()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('shares the issei_prefs bag rather than inventing a key', async () => {
    // One bag means "clear site data" resets every client-side preference
    // together, and Profile's toggles must survive the welcome writing to it.
    localStorage.setItem('issei_prefs', JSON.stringify({ reduceMotion: true }))
    renderWelcome()
    const prefs = JSON.parse(localStorage.getItem('issei_prefs'))
    expect(prefs).toEqual({ reduceMotion: true, welcomeSeenBy: [7] })
  })

  it('welcomes a SECOND account on the same device', async () => {
    // The bug this pins: a single boolean flag meant the second person to sign up
    // on a shared phone never got welcomed, because the first had already set it.
    const { unmount } = renderWelcome()
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    unmount()

    signIn(99)
    renderWelcome()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    // and the first account is still marked, not clobbered
    expect(
      JSON.parse(localStorage.getItem('issei_prefs')).welcomeSeenBy,
    ).toEqual([7, 99])
  })

  it('tolerates the old boolean flag shape instead of crashing', async () => {
    // A user mid-session when this shipped has `welcomeSeen: true` from the old
    // scheme. They get welcomed once more rather than hitting a type error.
    localStorage.setItem('issei_prefs', JSON.stringify({ welcomeSeen: true }))
    renderWelcome()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('survives an unreadable prefs bag instead of crashing', async () => {
    localStorage.setItem('issei_prefs', 'not json{')
    renderWelcome()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })
})
