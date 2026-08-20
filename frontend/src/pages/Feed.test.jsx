import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/posts', () => ({
  getFeed: vi.fn(),
}))
// Feed now renders the FriendsStrip (#75), which fetches the caller's friends. Mock it
// so these Feed tests don't hit the real axios client; default to no friends (the strip
// self-hides), and the strip test below overrides it.
vi.mock('../api/friends', () => ({
  getFriends: vi.fn(() => Promise.resolve({ data: [] })),
}))
import { getFeed } from '../api/posts'
import { getFriends } from '../api/friends'
import Feed from './Feed'

const post = (id, over = {}) => ({
  id,
  user_id: 10 + id,
  author_first_name: 'Lola',
  author_last_name: 'Cook',
  photo_url: `https://img.test/${id}.jpg`,
  dish_name: `Dish ${id}`,
  description: null,
  recipe_id: null,
  created_at: '2026-08-18T12:00:00Z',
  ...over,
})

function renderFeed() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/add/meal" element={<div>compose meal</div>} />
        <Route path="/friends" element={<div>friends page</div>} />
        <Route path="/u/:userId" element={<div>user profile</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Feed (Home)', () => {
  it('renders friends’ posts newest-first as cards', async () => {
    getFeed.mockResolvedValue({ data: [post(3), post(2), post(1)] })
    renderFeed()
    expect(await screen.findByText('Dish 3')).toBeInTheDocument()
    expect(screen.getByText('Dish 2')).toBeInTheDocument()
    expect(screen.getByText('Dish 1')).toBeInTheDocument()
  })

  it('shows the onboarding empty state (share + find friends) when the feed is empty', async () => {
    getFeed.mockResolvedValue({ data: [] })
    renderFeed()
    expect(await screen.findByText(/nothing cooking yet/i)).toBeInTheDocument()
    // The two cold-start actions.
    await userEvent.click(screen.getByRole('button', { name: /share a meal/i }))
    expect(await screen.findByText('compose meal')).toBeInTheDocument()
  })

  it('empty state routes to friends', async () => {
    getFeed.mockResolvedValue({ data: [] })
    renderFeed()
    await userEvent.click(await screen.findByRole('button', { name: /find friends/i }))
    expect(await screen.findByText('friends page')).toBeInTheDocument()
  })

  it('does not offer "load more" when a short page comes back', async () => {
    getFeed.mockResolvedValue({ data: [post(1)] })
    renderFeed()
    await screen.findByText('Dish 1')
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('shows the friends strip (active order) above the feed, tapping through to a profile', async () => {
    getFeed.mockResolvedValue({ data: [post(1)] })
    getFriends.mockResolvedValue({
      data: [{ user_id: 42, first_name: 'Ana', last_name: 'R', photo_url: null }],
    })
    renderFeed()
    // The strip requests the activity ordering, not the friendship-recency default.
    await waitFor(() => expect(getFriends).toHaveBeenCalledWith('active'))
    await userEvent.click(await screen.findByRole('button', { name: /ana/i }))
    expect(await screen.findByText('user profile')).toBeInTheDocument()
  })
})
