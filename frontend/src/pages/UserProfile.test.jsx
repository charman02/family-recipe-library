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
import { getUserProfile, requestFriend } from '../api/friends'
import UserProfile from './UserProfile'

function profile(over = {}) {
  return {
    user_id: 2,
    first_name: 'Lola',
    last_name: 'Remedios',
    friend_state: null,
    friend_can_accept: false,
    recipe_count: 3,
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
  it('shows the name and visible-recipe count', async () => {
    getUserProfile.mockResolvedValue({ data: profile() })
    renderAt()
    expect(await screen.findByText('Lola Remedios')).toBeInTheDocument()
    expect(screen.getByText(/3 recipes you can see/i)).toBeInTheDocument()
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
