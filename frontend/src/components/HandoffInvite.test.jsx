import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/lineage', () => ({
  handoffRecipe: vi.fn(() =>
    Promise.resolve({ data: { id: 1, state: 'pending', token: 'tok123' } }),
  ),
}))
import { handoffRecipe } from '../api/lineage'
import HandoffInvite from './HandoffInvite'

beforeEach(() => handoffRecipe.mockClear())

describe('HandoffInvite', () => {
  it('sends the handoff and then shows the shareable invite link', async () => {
    const onSent = vi.fn()
    render(<HandoffInvite recipeId={7} onSent={onSent} onSkip={() => {}} />)
    await userEvent.type(
      screen.getByPlaceholderText(/their email/i),
      'mom@example.com',
    )
    await userEvent.type(
      screen.getByPlaceholderText(/a note in your words/i),
      'your adobo',
    )
    await userEvent.click(screen.getByRole('button', { name: /get a link to send/i }))
    expect(handoffRecipe).toHaveBeenCalledWith(7, {
      to_email: 'mom@example.com',
      note: 'your adobo',
    })
    // The whole point: the token must be surfaced, not discarded. onSent must NOT
    // fire yet — that used to skip the share step entirely.
    expect(await screen.findByText(/\/invite\/tok123/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share the link/i })).toBeInTheDocument()
    expect(onSent).not.toHaveBeenCalled()
  })

  it('does not require an email — a link-only handoff works', async () => {
    render(<HandoffInvite recipeId={7} onSent={() => {}} onSkip={() => {}} />)
    // no email typed at all
    await userEvent.click(screen.getByRole('button', { name: /get a link to send/i }))
    expect(handoffRecipe).toHaveBeenCalledWith(7, { to_email: null, note: null })
    expect(await screen.findByText(/\/invite\/tok123/)).toBeInTheDocument()
  })

  it('calls onSent when the sender taps Done on the share step', async () => {
    const onSent = vi.fn()
    render(<HandoffInvite recipeId={7} onSent={onSent} onSkip={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /get a link to send/i }))
    await userEvent.click(await screen.findByRole('button', { name: /done/i }))
    expect(onSent).toHaveBeenCalled()
  })

  it('calls onSkip', async () => {
    const onSkip = vi.fn()
    render(<HandoffInvite recipeId={7} onSent={() => {}} onSkip={onSkip} />)
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('invites cooking and keeping, never remixing (private)', () => {
    render(
      <HandoffInvite
        recipeId={1}
        recipeVisibility="private"
        onSent={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByText(/cook it, and keep a copy/i)).toBeInTheDocument()
    expect(screen.queryByText(/remix/i)).not.toBeInTheDocument()
  })

  it('shows nudge copy for a public recipe', () => {
    render(
      <HandoffInvite
        recipeId={1}
        recipeVisibility="public"
        onSent={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(
      screen.getByText(/already in Browse|don’t have to go looking/i),
    ).toBeInTheDocument()
  })

  // --- the privacy worry round-2 testers raised, answered only as far as the
  // backend actually backs it up (handoff mints a grant; visibility is untouched,
  // so browse's effective_visibility filter still excludes the recipe) ---

  it('promises a private recipe stays out of Browse before you send', () => {
    render(
      <HandoffInvite
        recipeId={1}
        recipeVisibility="private"
        onSent={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(
      screen.getByText(/doesn’t put your recipe in Browse/i),
    ).toBeInTheDocument()
  })

  it('does NOT claim a private recipe stays out of Browse when it is public', () => {
    render(
      <HandoffInvite
        recipeId={1}
        recipeVisibility="public"
        onSent={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.queryByText(/doesn’t put your recipe in Browse/i)).toBeNull()
  })

  it('warns on the share step that the link itself is the permission', async () => {
    render(<HandoffInvite recipeId={7} onSent={() => {}} onSkip={() => {}} />)
    await userEvent.click(
      screen.getByRole('button', { name: /get a link to send/i }),
    )
    // /invite/{token} authorizes on the token alone, so a forwarded link works.
    expect(
      await screen.findByText(/anyone who has this link can open the recipe/i),
    ).toBeInTheDocument()
  })

  it('does not claim we email the recipient — nothing in the app sends mail', () => {
    render(<HandoffInvite recipeId={7} onSent={() => {}} onSkip={() => {}} />)
    expect(screen.getByText(/we won’t email them/i)).toBeInTheDocument()
  })

  it('tapping a starter fills the note', async () => {
    render(<HandoffInvite recipeId={7} onSent={() => {}} onSkip={() => {}} />)
    await userEvent.click(
      screen.getByRole('button', { name: /add the part i.m missing/i }),
    )
    expect(screen.getByPlaceholderText(/a note in your words/i)).toHaveValue(
      'Add the part I’m missing — the measures, the timing, the way you know it.',
    )
  })

  it('pre-selects the fill-in starter note when passing back to the source', () => {
    render(
      <HandoffInvite
        recipeId={7}
        sourceName="Lola"
        onSent={() => {}}
        onSkip={() => {}}
      />,
    )
    expect(screen.getByPlaceholderText(/a note in your words/i)).toHaveValue(
      'Add the part I’m missing — the measures, the timing, the way you know it.',
    )
  })
})
