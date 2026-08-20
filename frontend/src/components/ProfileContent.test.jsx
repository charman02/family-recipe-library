import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/sharing', () => ({ getUserRecipes: vi.fn() }))
vi.mock('../api/posts', () => ({ getUserPosts: vi.fn() }))
import { getUserRecipes } from '../api/sharing'
import { getUserPosts } from '../api/posts'
import ProfileContent from './ProfileContent'

const post = (id) => ({
  id,
  user_id: 2,
  author_first_name: 'Lola',
  author_last_name: 'R',
  photo_url: `https://img.test/${id}.jpg`,
  dish_name: `Dish ${id}`,
  created_at: '2026-08-20T12:00:00Z',
})

function renderContent() {
  return render(
    <MemoryRouter>
      <ProfileContent userId="2" />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserRecipes.mockResolvedValue({ data: [{ id: 7, name: 'Adobo' }] })
  getUserPosts.mockResolvedValue({ data: [post(1)] })
})

describe('ProfileContent', () => {
  it('loads recipes on the default tab and shows them', async () => {
    renderContent()
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
    expect(getUserRecipes).toHaveBeenCalledWith('2')
    // Posts aren't fetched until their tab is opened (lazy).
    expect(getUserPosts).not.toHaveBeenCalled()
  })

  it('lazy-loads posts only when the Posts tab is opened', async () => {
    renderContent()
    await screen.findByText('Adobo')
    await userEvent.click(screen.getByRole('tab', { name: /posts/i }))
    expect(await screen.findByText('Dish 1')).toBeInTheDocument()
    expect(getUserPosts).toHaveBeenCalledWith('2')
  })

  it('shows an empty message when a tab has nothing', async () => {
    getUserRecipes.mockResolvedValue({ data: [] })
    renderContent()
    expect(await screen.findByText(/no recipes to see yet/i)).toBeInTheDocument()
  })

  it('degrades to empty (no crash) if a fetch fails', async () => {
    getUserRecipes.mockRejectedValue(new Error('boom'))
    renderContent()
    expect(await screen.findByText(/no recipes to see yet/i)).toBeInTheDocument()
  })
})
