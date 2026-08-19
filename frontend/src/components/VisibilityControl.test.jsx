import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/sharing', () => ({
  setVisibility: vi.fn((_id, visibility) => Promise.resolve({ data: { visibility } })),
}))
import { setVisibility } from '../api/sharing'
import VisibilityControl from './VisibilityControl'

beforeEach(() => setVisibility.mockClear())

describe('VisibilityControl (3 concrete states)', () => {
  it('offers all three states, named by who sees them — not bare "public"/"private"', () => {
    render(<VisibilityControl recipe={{ id: 5, visibility: 'friends' }} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /everyone/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /friends only/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /only me/i })).toBeInTheDocument()
    // No security-overclaiming emoji.
    expect(document.body.textContent).not.toMatch(/🔒|🌐/)
  })

  it('marks the recipe’s current state selected', () => {
    render(<VisibilityControl recipe={{ id: 5, visibility: 'public' }} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /everyone/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: /friends only/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('picking a state PATCHes it in one tap, no confirm step', async () => {
    const onChange = vi.fn()
    render(<VisibilityControl recipe={{ id: 5, visibility: 'friends' }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /everyone/i }))
    expect(setVisibility).toHaveBeenCalledWith(5, 'public')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('public'))
  })

  it('shows "Shared with N" when the recipe has accepted grants', () => {
    render(
      <VisibilityControl
        recipe={{ id: 1, visibility: 'private', shared_with_count: 2 }}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/shared with 2 people/i)).toBeInTheDocument()
  })
})
