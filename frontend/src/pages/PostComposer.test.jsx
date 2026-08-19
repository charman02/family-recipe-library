import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/posts', () => ({ createPost: vi.fn(() => Promise.resolve({ data: { id: 7 } })) }))
// Stub the uploader so picking a file synchronously "uploads" and yields a URL —
// the composer's own logic (gate + submit) is what's under test, not Cloudinary.
vi.mock('../lib/photoUpload', () => ({
  PHOTO_ACCEPT: 'image/*',
  createUploader: () => ({
    upload: ({ onUrl }) => onUrl('https://img.test/meal.jpg'),
    retire: () => {},
  }),
}))
import { createPost } from '../api/posts'
import PostComposer from './PostComposer'

function renderComposer() {
  return render(
    <MemoryRouter initialEntries={['/add/meal']}>
      <Routes>
        <Route path="/add/meal" element={<PostComposer />} />
        <Route path="/" element={<div>feed</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const jpeg = () => new File(['x'], 'meal.jpg', { type: 'image/jpeg' })
function pickPhoto() {
  const input = screen.getByLabelText(/add a photo of your meal/i)
  Object.defineProperty(input, 'files', { value: [jpeg()], configurable: true })
  fireEvent.change(input)
}

beforeEach(() => vi.clearAllMocks())

describe('PostComposer', () => {
  it('disables Share until there is a photo AND a dish name', async () => {
    renderComposer()
    const share = screen.getByRole('button', { name: /share it/i })
    expect(share).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Adobo')
    expect(share).toBeDisabled() // name but no photo

    pickPhoto()
    await waitFor(() => expect(share).not.toBeDisabled()) // now both
  })

  it('posts the meal and lands on the feed', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday adobo')
    await userEvent.type(screen.getByLabelText(/description/i), 'come over')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /share it/i })).not.toBeDisabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    expect(createPost).toHaveBeenCalledWith({
      photo_url: 'https://img.test/meal.jpg',
      dish_name: 'Sunday adobo',
      description: 'come over',
      visibility: 'friends',
    })
    expect(await screen.findByText('feed')).toBeInTheDocument()
  })

  it('lets the author force a post public before sharing', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Adobo')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /share it/i })).not.toBeDisabled(),
    )
    await userEvent.click(screen.getByRole('radio', { name: /everyone/i }))
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    expect(createPost.mock.calls[0][0].visibility).toBe('public')
  })

  it('claims no recipe — it is a light meal post (no ingredients/steps fields)', () => {
    renderComposer()
    // The composer must not surface recipe machinery.
    expect(screen.queryByText(/ingredient/i)).toBeNull()
    expect(screen.queryByText(/step/i)).toBeNull()
  })
})
