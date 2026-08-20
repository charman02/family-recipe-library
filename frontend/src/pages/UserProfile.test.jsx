import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/friends', () => ({
  getUserProfile: vi.fn(),
  requestFriend: vi.fn(() => Promise.resolve({})),
  acceptFriend: vi.fn(() => Promise.resolve({})),
  removeFriend: vi.fn(() => Promise.resolve({})),
  getFriends: vi.fn(() => Promise.resolve({ data: [] })),
  getFriendRequests: vi.fn(() => Promise.resolve({ data: [] })),
}))
// UserProfile now renders <ProfileContent>, which loads the person's recipes + posts.
// Default both to empty so the identity/friend-button tests don't need real data;
// individual tests override getUserRecipes to assert the grid.
vi.mock('../api/sharing', () => ({
  getUserRecipes: vi.fn(() => Promise.resolve({ data: [] })),
}))
vi.mock('../api/posts', () => ({
  getUserPosts: vi.fn(() => Promise.resolve({ data: [] })),
}))
import { getUserProfile, requestFriend } from '../api/friends'
import { getUserRecipes } from '../api/sharing'
import UserProfile from './UserProfile'

function profile(over = {}) {
  return {
    user_id: 2,
    first_name: 'Lola',
    last_name: 'Remedios',
    friend_state: null,
    friend_can_accept: false,
    recipe_count: 3,
    post_count: 0,
    ...over,
  }
}

const renderAt = (userId = '2') =>
  render(
    <MemoryRouter initialEntries={[`/u/${userId}`]}>
      <Routes>
        <Route path="/u/:userId" element={<UserProfile />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('issei_user', JSON.stringify({ id: 1, first_name: 'Me' }))
})
afterEach(() => localStorage.clear())

describe('UserProfile', () => {
  it('shows the name and the recipes/posts tabs', async () => {
    getUserProfile.mockResolvedValue({ data: profile() })
    renderAt()
    expect(await screen.findByText('Lola Remedios')).toBeInTheDocument()
    // The tabbed profile content replaced the old bare recipe-count line.
    expect(screen.getByRole('tab', { name: /recipes/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /posts/i })).toBeInTheDocument()
  })

  it('loads the person’s recipes into the grid', async () => {
    getUserProfile.mockResolvedValue({ data: profile() })
    getUserRecipes.mockResolvedValueOnce({
      data: [{ id: 7, name: 'Adobo', author_full_name: 'Lola Remedios' }],
    })
    renderAt()
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
    expect(getUserRecipes).toHaveBeenCalledWith('2')
  })

  it('shows a warm nudge (no tabs) when a non-friend can see nothing', async () => {
    getUserProfile.mockResolvedValue({
      data: profile({ friend_state: null, recipe_count: 0, post_count: 0 }),
    })
    renderAt()
    expect(await screen.findByText(/nothing to see here yet/i)).toBeInTheDocument()
    expect(screen.getByText(/add lola as a friend/i)).toBeInTheDocument()
    // The nudge replaces the tabs entirely.
    expect(screen.queryByRole('tab', { name: /recipes/i })).toBeNull()
  })

  it('shows the tabs (not the nudge) for a friend even with nothing loaded', async () => {
    getUserProfile.mockResolvedValue({
      data: profile({ friend_state: 'accepted', recipe_count: 0, post_count: 0 }),
    })
    renderAt()
    await screen.findByText('Lola Remedios')
    expect(screen.getByRole('tab', { name: /recipes/i })).toBeInTheDocument()
    expect(screen.queryByText(/nothing to see here yet/i)).toBeNull()
  })

  it('offers "Add friend" when there is no relationship, and sends the request', async () => {
    getUserProfile.mockResolvedValue({ data: profile({ friend_state: null }) })
    renderAt('2')
    const add = await screen.findByRole('button', { name: /add friend/i })
    await userEvent.click(add)
    expect(requestFriend).toHaveBeenCalledWith(2)
  })

  it('shows "Requested" (disabled) for an outgoing pending request', async () => {
    getUserProfile.mockResolvedValue({
      data: profile({ friend_state: 'pending', friend_can_accept: false }),
    })
    renderAt()
    const btn = await screen.findByRole('button', { name: /requested/i })
    expect(btn).toBeDisabled()
  })

  it('offers to accept an incoming pending request', async () => {
    getUserProfile.mockResolvedValue({
      data: profile({ friend_state: 'pending', friend_can_accept: true }),
    })
    renderAt()
    expect(
      await screen.findByRole('button', { name: /accept friend request/i }),
    ).toBeInTheDocument()
  })

  it('shows "Friends ✓" when already friends', async () => {
    getUserProfile.mockResolvedValue({ data: profile({ friend_state: 'accepted' }) })
    renderAt()
    expect(await screen.findByRole('button', { name: /friends/i })).toBeInTheDocument()
  })

  it('shows no friend button on your own profile', async () => {
    getUserProfile.mockResolvedValue({ data: profile({ user_id: 1 }) })
    renderAt('1')
    await screen.findByText('Lola Remedios')
    expect(screen.queryByRole('button', { name: /add friend|friends|requested/i })).toBeNull()
  })
})
