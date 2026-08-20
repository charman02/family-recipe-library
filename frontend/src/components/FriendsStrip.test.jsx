import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'

vi.mock('../api/friends', () => ({
  getFriends: vi.fn(),
}))
import { getFriends } from '../api/friends'
import FriendsStrip from './FriendsStrip'

const friend = (id, first, over = {}) => ({
  user_id: id,
  first_name: first,
  last_name: 'X',
  photo_url: null,
  ...over,
})

// The profile route echoes the :userId param so a tap-through can assert WHICH profile.
function UserProfileStub() {
  const { userId } = useParams()
  return <div>profile {userId}</div>
}

function renderStrip() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FriendsStrip />} />
        <Route path="/u/:userId" element={<UserProfileStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('FriendsStrip (#75)', () => {
  it('requests the ACTIVE ordering, not the friendship-recency default', async () => {
    getFriends.mockResolvedValue({ data: [friend(1, 'Ana')] })
    renderStrip()
    await waitFor(() => expect(getFriends).toHaveBeenCalledWith('active'))
  })

  it('renders every friend by first name and keeps the order the API returned', async () => {
    // The API already sorted (active first); the strip must not resort. Ana leads.
    getFriends.mockResolvedValue({
      data: [friend(1, 'Ana'), friend(2, 'Ben'), friend(3, 'Cy')],
    })
    renderStrip()
    const labels = await screen.findAllByText(/Ana|Ben|Cy/)
    expect(labels.map((n) => n.textContent)).toEqual(['Ana', 'Ben', 'Cy'])
  })

  it('shows a monogram (first initial) when a friend has no photo', async () => {
    getFriends.mockResolvedValue({ data: [friend(1, 'Ana', { photo_url: null })] })
    renderStrip()
    // Avatar renders the uppercase first initial as its monogram fallback.
    expect(await screen.findByText('A')).toBeInTheDocument()
  })

  it('renders a photo when the friend has one, not a monogram', async () => {
    getFriends.mockResolvedValue({
      data: [friend(1, 'Ana', { photo_url: 'https://res.cloudinary.com/issei/avatars/a.jpg' })],
    })
    renderStrip()
    const img = await screen.findByRole('img', { name: /ana/i })
    expect(img).toHaveAttribute('src', 'https://res.cloudinary.com/issei/avatars/a.jpg')
  })

  it('taps through to a friend’s profile', async () => {
    getFriends.mockResolvedValue({ data: [friend(42, 'Ana')] })
    renderStrip()
    await userEvent.click(await screen.findByRole('button', { name: /ana/i }))
    expect(await screen.findByText(/profile 42/)).toBeInTheDocument()
  })

  it('renders nothing when the caller has no friends (feed’s own empty state covers it)', async () => {
    getFriends.mockResolvedValue({ data: [] })
    const { container } = renderStrip()
    // Let the effect resolve, then assert the component produced no rail.
    await waitFor(() => expect(getFriends).toHaveBeenCalled())
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders nothing (not a crash) if the friends fetch fails', async () => {
    getFriends.mockRejectedValue(new Error('offline'))
    const { container } = renderStrip()
    await waitFor(() => expect(getFriends).toHaveBeenCalled())
    expect(container.querySelector('button')).toBeNull()
  })
})
