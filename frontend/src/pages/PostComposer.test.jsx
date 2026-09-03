import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'

vi.mock('../api/posts', () => ({ createPost: vi.fn(() => Promise.resolve({ data: { id: 7 } })) }))
// Stub the uploader so picking a file synchronously "uploads" and yields a URL —
// the composer's own logic (gate + submit) is what's under test, not Cloudinary.
// `hoisted` so the mock factory can read it: 'instant' resolves the upload synchronously
// (what every pre-existing test wants), 'hang' leaves it in flight with uploading=true —
// the state in which "Write one" used to navigate away and discard the photo.
const uploadState = vi.hoisted(() => ({ mode: 'instant' }))
vi.mock('../lib/photoUpload', () => ({
  PHOTO_ACCEPT: 'image/*',
  createUploader: () => ({
    upload: ({ onUrl, onBusy }) => {
      if (uploadState.mode === 'hang') return onBusy(true)
      return onUrl('https://img.test/meal.jpg')
    },
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

function renderComposer(state) {
  return render(
    <MemoryRouter
      initialEntries={['/add', { pathname: '/add/meal', state }]}
      initialIndex={1}
    >
      <Routes>
        <Route path="/add/meal" element={<PostComposer />} />
        <Route path="/" element={<FeedSpy />} />
        <Route path="/add" element={<div>add chooser</div>} />
        {/* Where "Write one" goes. Echoes back what it was handed so the test can assert
            the draft actually crossed the route boundary. */}
        <Route
          path="/add/recipe"
          element={<RecipeFlowSpy />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// The feed, plus a way to pop history so push-vs-replace is observable.
function FeedSpy() {
  const navigate = useNavigate()
  return (
    <div>
      feed
      <button onClick={() => navigate(-1)}>go-back</button>
    </div>
  )
}

// Stands in for PlantRecipe: renders the draft it received, and can pop history.
function RecipeFlowSpy() {
  const { state } = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <p>recipe flow: {JSON.stringify(state?.postDraft)}</p>
      <button onClick={() => navigate(-1)}>pop-back</button>
    </div>
  )
}

const jpeg = () => new File(['x'], 'meal.jpg', { type: 'image/jpeg' })
function pickPhoto() {
  const input = screen.getByLabelText(/add a photo of your meal/i)
  Object.defineProperty(input, 'files', { value: [jpeg()], configurable: true })
  fireEvent.change(input)
}

beforeEach(() => {
  vi.clearAllMocks()
  uploadState.mode = 'instant'
})

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
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
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
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /adobo/i }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('Adobo')
  })

  it('does not overwrite a dish name the author already typed', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday dinner')
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /adobo/i }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('Sunday dinner')
  })

  it('can remove an attached recipe, sending null again', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Adobo')
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /sinigang/i }))
    // Remove it.
    await userEvent.click(screen.getByRole('button', { name: /remove recipe/i }))
    // Back to the dashed add button.
    expect(screen.getByRole('button', { name: /^attach one$/i })).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp('A{20}') }))
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('A'.repeat(120))
  })

  it('filters the picker list by search', async () => {
    renderComposer()
    pickPhoto()
    await userEvent.click(screen.getByRole('button', { name: /^attach one$/i }))
    await screen.findByRole('button', { name: /adobo/i })
    await userEvent.type(screen.getByLabelText(/search your recipes/i), 'sinig')
    expect(screen.queryByRole('button', { name: /adobo/i })).toBeNull()
    expect(screen.getByRole('button', { name: /sinigang/i })).toBeInTheDocument()
  })
})

// #81 — "Write or attach a recipe". Reported by the owner: attaching only offers recipes
// you ALREADY own, so someone who just cooked something they'd never written down had to
// abandon the post, go write it, and start over.
describe('PostComposer — write a recipe mid-post', () => {
  const draft = {
    photo_url: 'https://img.test/meal.jpg',
    dish_name: 'Sunday adobo',
    description: 'the good one',
    visibility: 'public',
  }

  it('offers both doors before anything is attached', async () => {
    renderComposer()
    expect(screen.getByRole('button', { name: /^write one$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^attach one$/i })).toBeInTheDocument()
  })

  it('carries the whole post draft into the recipe flow', async () => {
    renderComposer()
    // Fill the post out first — this is the state that must survive the detour.
    fireEvent.change(screen.getByLabelText(/add a photo of your meal/i), {
      target: { files: [new File(['x'], 'm.jpg', { type: 'image/jpeg' })] },
    })
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday adobo')
    await userEvent.type(screen.getByLabelText(/description/i), 'the good one')
    await userEvent.click(screen.getByRole('radio', { name: /everyone/i }))

    await userEvent.click(screen.getByRole('button', { name: /^write one$/i }))
    const handed = JSON.parse(
      (await screen.findByText(/^recipe flow:/)).textContent.replace('recipe flow: ', ''),
    )
    expect(handed).toEqual({
      photo_url: 'https://img.test/meal.jpg',
      dish_name: 'Sunday adobo',
      description: 'the good one',
      visibility: 'public',
    })
  })

  it('restores the draft and shows the recipe attached on the way back', async () => {
    renderComposer({ postDraft: draft, attachRecipe: { id: 42, name: 'Adobo', cover_photo_url: null } })
    // Every field is back, on the FIRST render — no empty-then-filled flash.
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('Sunday adobo')
    expect(screen.getByLabelText(/description/i)).toHaveValue('the good one')
    expect(screen.getByAltText(/your meal/i)).toHaveAttribute('src', draft.photo_url)
    expect(screen.getByRole('radio', { name: /everyone/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    // The doors are gone once something is attached.
    expect(screen.queryByRole('button', { name: /^write one$/i })).not.toBeInTheDocument()
  })

  it('sends the newly written recipe id with the post', async () => {
    renderComposer({ postDraft: draft, attachRecipe: { id: 42, name: 'Adobo', cover_photo_url: null } })
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    await waitFor(() =>
      expect(createPost).toHaveBeenCalledWith(
        expect.objectContaining({ recipe_id: 42, dish_name: 'Sunday adobo' }),
      ),
    )
  })

  it('fills an empty dish name from the recipe it comes back with, capped at 120', async () => {
    const long = 'x'.repeat(200)
    renderComposer({
      postDraft: { ...draft, dish_name: '' },
      attachRecipe: { id: 42, name: long, cover_photo_url: null },
    })
    // Same rule as #72's attach path: fill only when empty, and never exceed the field's
    // own maxLength or the post 422s on submit.
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('x'.repeat(120))
  })

  it('never overwrites a dish name the author already typed', async () => {
    renderComposer({
      postDraft: { ...draft, dish_name: 'My own words' },
      attachRecipe: { id: 42, name: 'Adobo', cover_photo_url: null },
    })
    expect(screen.getByLabelText(/what is it\?/i)).toHaveValue('My own words')
  })

  it('does not leave a live, fully-filled composer one back-gesture behind the feed', async () => {
    // The duplicate-post path: this entry's router state holds a COMPLETE draft, so a
    // pushed navigation to the feed left "Share it" armed one back-gesture away, and the
    // server has no dedupe. Sharing must REPLACE the entry.
    renderComposer({
      postDraft: draft,
      attachRecipe: { id: 42, name: 'Adobo', cover_photo_url: null },
    })
    await userEvent.click(screen.getByRole('button', { name: /share it/i }))
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1))
    await screen.findByText('feed')

    await userEvent.click(screen.getByRole('button', { name: 'go-back' }))
    // Back goes PAST the composer, so there is nothing to re-submit.
    expect(await screen.findByText(/add chooser/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /share it/i })).not.toBeInTheDocument()
    expect(createPost).toHaveBeenCalledTimes(1)
  })

  it('refuses to leave for the recipe flow while the photo is still uploading', async () => {
    uploadState.mode = 'hang'
    renderComposer()
    fireEvent.change(screen.getByLabelText(/add a photo of your meal/i), {
      target: { files: [new File(['x'], 'm.jpg', { type: 'image/jpeg' })] },
    })
    await screen.findByText(/uploading/i)
    const write = screen.getByRole('button', { name: /^write one$/i })
    expect(write).toBeDisabled()
    await userEvent.click(write, { pointerEventsCheck: 0 })
    // Leaving here stranded the in-flight upload: the recipe inherited no cover and the
    // post came back photo-less, forcing a re-upload of the same image.
    expect(screen.queryByText(/^recipe flow:/)).not.toBeInTheDocument()
  })

  it('survives the phone back-gesture out of the recipe flow', async () => {
    renderComposer()
    await userEvent.type(screen.getByLabelText(/what is it\?/i), 'Sunday adobo')
    await userEvent.click(screen.getByRole('button', { name: /^write one$/i }))
    await screen.findByText(/^recipe flow:/)
    // POPPING history (the swipe/back gesture) doesn't run our handler, so the draft has to
    // live on the composer's own history entry — otherwise back lands on an empty form.
    await userEvent.click(screen.getByRole('button', { name: 'pop-back' }))
    expect(await screen.findByLabelText(/what is it\?/i)).toHaveValue('Sunday adobo')
  })
})
