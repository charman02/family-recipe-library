import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/friends', () => ({
  getFriends: vi.fn(),
  getFriendRequests: vi.fn(),
  getFriendSuggestions: vi.fn(),
  acceptFriend: vi.fn(() => Promise.resolve({})),
  removeFriend: vi.fn(() => Promise.resolve({})),
  requestFriend: vi.fn(() => Promise.resolve({})),
}))
import {
  getFriends,
  getFriendRequests,
  getFriendSuggestions,
  acceptFriend,
  requestFriend,
} from '../api/friends'
import Friends from './Friends'

const person = (id, first, extra = {}) => ({
  id,
  user_id: id,
  first_name: first,
  last_name: 'Cook',
  state: 'pending',
  outgoing: false,
  created_at: '2026-08-18T00:00:00Z',
  ...extra,
})

function mock({ friends = [], requests = [], suggestions = [] } = {}) {
  getFriends.mockResolvedValue({ data: friends })
  getFriendRequests.mockResolvedValue({ data: requests })
  getFriendSuggestions.mockResolvedValue({ data: suggestions })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Friends />
    </MemoryRouter>,
  )

beforeEach(() => vi.clearAllMocks())

describe('Friends page', () => {
  it('shows the empty state when there is nobody anywhere', async () => {
    mock({})
    renderPage()
    expect(await screen.findByText(/no one here yet/i)).toBeInTheDocument()
  })

  it('lists incoming requests and accepts one', async () => {
    mock({ requests: [person(2, 'Lola', { outgoing: false })] })
    renderPage()
    expect(await screen.findByText('Lola Cook')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    expect(acceptFriend).toHaveBeenCalledWith(2)
  })

  it('shows handoff-seeded suggestions with a reason, and adds one', async () => {
    mock({
      suggestions: [
        { user_id: 3, first_name: 'Tita', last_name: 'B', reason: 'sent' },
      ],
    })
    renderPage()
    expect(await screen.findByText('Tita B')).toBeInTheDocument()
    expect(screen.getByText(/you sent them a recipe/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(requestFriend).toHaveBeenCalledWith(3)
  })

  it('lists current friends', async () => {
    mock({ friends: [person(4, 'Sam', { state: 'accepted' })] })
    renderPage()
    expect(await screen.findByText('Sam Cook')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })
})
