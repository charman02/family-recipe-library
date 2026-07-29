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
    await userEvent.click(screen.getByRole('button', { name: /pass it on/i }))
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
    await userEvent.click(screen.getByRole('button', { name: /pass it on/i }))
    expect(handoffRecipe).toHaveBeenCalledWith(7, { to_email: null, note: null })
    expect(await screen.findByText(/\/invite\/tok123/)).toBeInTheDocument()
  })

  it('calls onSent when the sender taps Done on the share step', async () => {
    const onSent = vi.fn()
    render(<HandoffInvite recipeId={7} onSent={onSent} onSkip={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /pass it on/i }))
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
    expect(screen.getByText(/cook it and keep it/i)).toBeInTheDocument()
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
      screen.getByText(/let them know|already public/i),
    ).toBeInTheDocument()
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
