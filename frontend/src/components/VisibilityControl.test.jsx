import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/sharing', () => ({
  setVisibility: vi.fn(() =>
    Promise.resolve({ data: { visibility: 'public' } }),
  ),
}))
import { setVisibility } from '../api/sharing'
import VisibilityControl from './VisibilityControl'

beforeEach(() => setVisibility.mockClear())

describe('VisibilityControl', () => {
  it('private → publishes on a single toggle, with no confirm step', async () => {
    const onChange = vi.fn()
    render(
      <VisibilityControl
        recipe={{
          id: 5,
          parent_recipe_id: null,
          visibility: 'private',
          child_count: 0,
        }}
        onChange={onChange}
      />,
    )
    // Named by who sees it, matching VisibilityChoice — not "Private"/"Public".
    expect(screen.getByText('Only me')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /change to everyone/i }),
    )
    expect(setVisibility).toHaveBeenCalledWith(5, 'public')
    expect(onChange).toHaveBeenCalledWith('public')
  })

  it('uses no padlock/globe emoji and no bare "public"/"private" labels', () => {
    const { container } = render(
      <VisibilityControl
        recipe={{
          id: 5,
          parent_recipe_id: null,
          visibility: 'private',
          child_count: 0,
        }}
        onChange={() => {}}
      />,
    )
    expect(container.textContent).not.toMatch(/🔒|🌐/)
    expect(container.textContent).not.toMatch(/private/i)
  })

  it('always names what "Everyone" exposes, in both states', () => {
    const { rerender } = render(
      <VisibilityControl
        recipe={{ id: 9, parent_recipe_id: null, visibility: 'public', child_count: 2 }}
        onChange={() => {}}
      />,
    )
    expect(
      screen.getByText(/shows up in Browse, where anyone can find it/i),
    ).toBeInTheDocument()
    // The ambient advisory prose is gone.
    expect(screen.queryByText(/already saved a copy keeps theirs/i)).toBeNull()

    rerender(
      <VisibilityControl
        recipe={{ id: 9, parent_recipe_id: null, visibility: 'private', child_count: 0 }}
        onChange={() => {}}
      />,
    )
    // A private recipe needs no warning about staying private, but it DOES need
    // to know what the button it's about to press means.
    expect(screen.getByText(/shows up in Browse/i)).toBeInTheDocument()
    expect(screen.queryByText(/stays in your kitchen/i)).toBeNull()
  })

  it('shows "Shared with N" when a private root has accepted grants', () => {
    render(
      <VisibilityControl
        recipe={{
          id: 1,
          parent_recipe_id: null,
          visibility: 'private',
          child_count: 0,
          shared_with_count: 2,
        }}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/shared with 2 people/i)).toBeInTheDocument()
  })
})
