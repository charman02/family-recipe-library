import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/posts', () => ({ getPost: vi.fn() }))
import { getPost } from '../api/posts'
import PostPage from './PostPage'

const postData = (over = {}) => ({
  id: 5,
  user_id: 42,
  author_first_name: 'Ana',
  author_last_name: 'Cruz',
  author_photo_url: null,
  photo_url: 'https://img.test/meal.jpg',
  dish_name: 'Sunday Adobo',
  description: 'slow-cooked all afternoon',
  recipe_id: null,
  visibility: 'public',
  created_at: '2026-08-20T12:00:00Z',
  ...over,
})

function renderPost(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/posts/${id}`]}>
      <Routes>
        <Route path="/posts/:id" element={<PostPage />} />
        <Route path="/recipes/:id" element={<div>recipe page</div>} />
        <Route path="/u/:userId" element={<div>author profile</div>} />
        <Route path="/browse" element={<div>browse page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('issei_user', JSON.stringify({ id: 1 })) // viewer is not the author
})

describe('PostPage (#71)', () => {
  it('renders the meal — photo, dish name, description, author', async () => {
    getPost.mockResolvedValue({ data: postData() })
    renderPost()
    expect(await screen.findByText('Sunday Adobo')).toBeInTheDocument()
    expect(screen.getByText(/slow-cooked all afternoon/i)).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sunday adobo/i })).toHaveAttribute(
      'src',
      'https://img.test/meal.jpg',
    )
  })

  it('links through to the attached recipe when there is one', async () => {
    getPost.mockResolvedValue({ data: postData({ recipe_id: 9 }) })
    renderPost()
    await screen.findByText('Sunday Adobo')
    await userEvent.click(screen.getByRole('button', { name: /see the recipe/i }))
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })

  it('shows no recipe link when the post has none', async () => {
    getPost.mockResolvedValue({ data: postData({ recipe_id: null }) })
    renderPost()
    await screen.findByText('Sunday Adobo')
    expect(screen.queryByRole('button', { name: /see the recipe/i })).toBeNull()
  })

  it('tapping the author opens their profile', async () => {
    getPost.mockResolvedValue({ data: postData() })
    renderPost()
    await userEvent.click(await screen.findByRole('button', { name: /ana cruz/i }))
    expect(await screen.findByText('author profile')).toBeInTheDocument()
  })

  it('shows a not-available message on a 404 (a post you may not see, or gone)', async () => {
    getPost.mockRejectedValue({ response: { status: 404 } })
    renderPost()
    expect(await screen.findByText(/isn.t available/i)).toBeInTheDocument()
  })
})
