import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

vi.mock('../api/posts', () => ({
  getIncomingRequests: vi.fn(),
  fulfillPost: vi.fn(() => Promise.resolve({ data: {} })),
}))
// RecipePicker lists the caller's own recipes via client.get('/recipes').
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(() =>
      Promise.resolve({
        data: [{ id: 3, name: 'Adobo', cover_photo_url: null, origin_attribution: 'Lola' }],
      }),
    ),
  },
  toUserMessage: (err, fallback) => fallback,
}))
import { getIncomingRequests, fulfillPost } from '../api/posts'
import Requests from './Requests'

const row = (over = {}) => ({
  post: {
    id: 5,
    user_id: 1,
    dish_name: 'Sinigang',
    description: 'the sour one',
    photo_url: 'https://img.test/a.jpg',
    visibility: 'friends',
    recipe_id: null,
    request_count: 2,
    requested_by_me: false,
    author_first_name: 'Cook',
    author_last_name: 'One',
    created_at: '2026-09-04T10:00:00Z',
  },
  requesters: [
    { user_id: 7, first_name: 'Ana', last_name: 'Cruz', photo_url: null, created_at: '2026-09-04T10:00:00Z' },
    { user_id: 8, first_name: 'Ben', last_name: 'Tan', photo_url: null, created_at: '2026-09-04T10:01:00Z' },
  ],
  ...over,
})

// Echoes what the authoring flow was handed, so the test can prove the hand-off happened
// across a real route boundary rather than trusting a mock.
function RecipeFlowSpy() {
  const { state } = useLocation()
  return (
    <div>
      <p>flow draft: {JSON.stringify(state?.postDraft)}</p>
      <p>fulfilling: {String(state?.fulfillPostId)}</p>
    </div>
  )
}

function renderPage(rows = [], state) {
  getIncomingRequests.mockResolvedValue({ data: rows })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/requests', state }]}>
      <Routes>
        <Route path="/requests" element={<Requests />} />
        <Route path="/add/recipe" element={<RecipeFlowSpy />} />
        <Route path="/u/:id" element={<div>their profile</div>} />
        <Route path="/profile" element={<div>you page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Requests — the cook’s asks (#79)', () => {
  it('shows the dish, how many asked, and WHO asked', async () => {
    renderPage([row()])
    expect(await screen.findByText('Sinigang')).toBeInTheDocument()
    expect(screen.getByText('2 people asked')).toBeInTheDocument()
    // Names, not just a number — this is the one audience entitled to them.
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ben Tan')).toBeInTheDocument()
  })

  it('says plainly that nobody else can see it', async () => {
    renderPage([row()])
    expect(await screen.findByText(/only you can see this/i)).toBeInTheDocument()
  })

  it('singular reads as one person, not "1 people"', async () => {
    renderPage([
      row({
        requesters: [
          { user_id: 7, first_name: 'Ana', last_name: 'Cruz', photo_url: null, created_at: 'x' },
        ],
      }),
    ])
    expect(await screen.findByText('1 person asked')).toBeInTheDocument()
  })

  it('"Write the recipe" hands the post over exactly as the composer does (#81)', async () => {
    renderPage([row()])
    await userEvent.click(await screen.findByRole('button', { name: /write the recipe/i }))
    const draft = JSON.parse(
      (await screen.findByText(/^flow draft:/)).textContent.replace('flow draft: ', ''),
    )
    expect(draft).toEqual({
      photo_url: 'https://img.test/a.jpg',
      dish_name: 'Sinigang',
      description: 'the sour one',
      visibility: 'friends',
    })
    // ...plus which post to fulfil once the recipe exists.
    expect(screen.getByText('fulfilling: 5')).toBeInTheDocument()
  })

  it('"Attach one" answers the ask with a recipe already written', async () => {
    renderPage([row()])
    await userEvent.click(await screen.findByRole('button', { name: /attach one/i }))
    await userEvent.click(await screen.findByText('Adobo'))
    await waitFor(() => expect(fulfillPost).toHaveBeenCalledWith(5, 3))
  })

  it('reloads after fulfilling, so an answered ask leaves the list', async () => {
    getIncomingRequests.mockResolvedValueOnce({ data: [row()] })
    getIncomingRequests.mockResolvedValueOnce({ data: [] })
    render(
      <MemoryRouter>
        <Requests />
      </MemoryRouter>,
    )
    await screen.findByText('Sinigang')
    await userEvent.click(screen.getByRole('button', { name: /attach one/i }))
    await userEvent.click(await screen.findByText('Adobo'))
    expect(await screen.findByText(/nobody's asked yet/i)).toBeInTheDocument()
  })

  it('surfaces a failure instead of pretending it sent', async () => {
    fulfillPost.mockRejectedValueOnce(new Error('nope'))
    renderPage([row()])
    await screen.findByText('Sinigang')
    await userEvent.click(screen.getByRole('button', { name: /attach one/i }))
    await userEvent.click(await screen.findByText('Adobo'))
    expect(await screen.findByText(/couldn.t send that just now/i)).toBeInTheDocument()
    // The ask is still listed, so the cook can try again.
    expect(screen.getByText('Sinigang')).toBeInTheDocument()
  })

  it('an empty list explains what would put something in it', async () => {
    renderPage([])
    expect(await screen.findByText(/nobody's asked yet/i)).toBeInTheDocument()
  })

  it('a requester name opens their profile', async () => {
    renderPage([row()])
    await userEvent.click(await screen.findByText('Ana Cruz'))
    expect(await screen.findByText('their profile')).toBeInTheDocument()
  })

  it('explains a failed delivery instead of showing an unchanged list', async () => {
    // Arriving from the write-the-recipe flow after fulfil failed. Without this the cook sees
    // the ask still listed with no explanation, reads it as "the save didn't work", and the
    // obvious recovery is to write the whole recipe again.
    renderPage([row()], { deliveryFailed: 'Sinigang' })
    expect(await screen.findByText(/is saved, but sending it didn.t go through/i)).toBeInTheDocument()
    expect(screen.getByText(/“Sinigang”/)).toBeInTheDocument()
    // And it points at the recovery that actually works (the message, not the button).
    expect(screen.getByText(/use .attach one. to try again/i)).toBeInTheDocument()
  })

  it('says nothing extra on a normal visit', async () => {
    renderPage([row()])
    await screen.findByText('Sinigang')
    expect(screen.queryByText(/didn.t go through/i)).not.toBeInTheDocument()
  })
})
