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
// RecipePicker (opened by the "Attach a recipe" flow) fetches the caller's recipes via
// client.get('/recipes'). Default to two owned recipes; tests that don't open the picker
// never trigger it.
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(() =>
      Promise.resolve({
        data: [
          { id: 3, name: 'Adobo', cover_photo_url: null, origin_attribution: 'Lola' },
          { id: 9, name: 'Sinigang', cover_photo_url: null, origin_attribution: null },
        ],
      }),
    ),
  },
  toUserMessage: (err, fallback) => fallback,
}))
import { createPost } from '../api/posts'
import client from '../api/client'
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
      recipe_id: null, // no recipe attached in this flow
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

  // --- Attach a recipe (#72) ---

  it('attaches a chosen recipe and sends its id with the post', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday adobo')
    // Open the picker and choose a recipe.
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await userEvent.click(await screen.findByRole('button', { name: /adobo/i }))
    // The chip now shows the attached recipe (and the picker is gone).
    expect(screen.queryByRole('dialog', { name: /attach a recipe/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    expect(createPost.mock.calls[0][0].recipe_id).toBe(3)
  })

  it('prefills an EMPTY dish name from the attached recipe, but never overwrites typed text', async () => {
    renderComposer()
    pickPhoto()
    // Name still empty → attaching Adobo fills it.
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await userEvent.click(await screen.findByRole('button', { name: /adobo/i }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('Adobo')
  })

  it('does not overwrite a dish name the author already typed', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday dinner')
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await userEvent.click(await screen.findByRole('button', { name: /adobo/i }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('Sunday dinner')
  })

  it('can remove an attached recipe, sending null again', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Adobo')
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await userEvent.click(await screen.findByRole('button', { name: /sinigang/i }))
    // Remove it.
    await userEvent.click(screen.getByRole('button', { name: /remove recipe/i }))
    // Back to the dashed add button.
    expect(screen.getByRole('button', { name: /attach one of your recipes/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    expect(createPost.mock.calls[0][0].recipe_id).toBeNull()
  })

  it('clamps a very long recipe name to the 120-char dish-name cap when prefilling', async () => {
    // Recipe names are uncapped but a post's dish_name maxes at 120. The programmatic
    // prefill bypasses the input's maxLength, so it must clamp itself or submit would 422.
    const longName = 'A'.repeat(200)
    client.get.mockResolvedValueOnce({
      data: [{ id: 5, name: longName, cover_photo_url: null, origin_attribution: null }],
    })
    renderComposer()
    pickPhoto()
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp('A{20}') }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('A'.repeat(120))
  })

  it('filters the picker list by search', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.click(screen.getByRole('button', { name: /attach one of your recipes/i }))
    await screen.findByRole('button', { name: /adobo/i })
    await userEvent.type(screen.getByLabelText(/search your recipes/i), 'sinig')
    expect(screen.queryByRole('button', { name: /adobo/i })).toBeNull()
    expect(screen.getByRole('button', { name: /sinigang/i })).toBeInTheDocument()
  })
})
