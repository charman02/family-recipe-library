import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
vi.mock('../api/lineage', () => ({ getSharedWithMe: vi.fn() }))
import client from '../api/client'
import { getSharedWithMe } from '../api/lineage'
import Home from './Home'

const OWNED = {
  id: 1,
  user_id: 7,
  name: 'Sinigang',
  cuisine: 'Filipino',
  origin_attribution: 'Lola Remedios · Cebu',
  cover_photo_url: null,
}
const HANDED = {
  id: 2,
  user_id: 42,
  name: 'Braised pork belly',
  author_full_name: 'Auntie Ling',
  cover_photo_url: null,
}

// Home reads three endpoints off one mocked client.get, so route by URL rather
// than by call order — the component fires them concurrently.
function mockApi({ mine = [], browse = [], shared = [] } = {}) {
  client.get.mockImplementation((url) => {
    if (url === '/recipes') return Promise.resolve({ data: mine })
    if (url === '/recipes/browse') return Promise.resolve({ data: browse })
    return Promise.resolve({ data: [] })
  })
  getSharedWithMe.mockResolvedValue({ data: shared })
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<div>add page</div>} />
        <Route path="/shared" element={<div>shared page</div>} />
        <Route path="/recipes/:id" element={<div>recipe page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('issei_user', JSON.stringify({ id: 7, first_name: 'Mia' }))
  client.get.mockReset()
  getSharedWithMe.mockReset()
})

describe('Home — first run, empty-handed', () => {
  it('orients in one line and points at the first action', async () => {
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/the one person who asked for it/i)).toBeInTheDocument()
  })

  it('does NOT re-teach what /welcome just taught', async () => {
    // /welcome runs immediately before this screen for a new signup and shows
    // the sample card. Repeating it here read as the app forgetting it had
    // already explained itself.
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
    expect(screen.queryByText('their way')).not.toBeInTheDocument()
    expect(screen.queryByText(/a good splash/i)).not.toBeInTheDocument()
  })

  it('makes NO claim about voice or audio anywhere', async () => {
    // Step.voice_note is a TEXT column typed by whoever recorded the recipe.
    // Implying a recording would be a lie about the product.
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/\bvoice\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|audio|listen/i)).not.toBeInTheDocument()
  })

  it('keeps the first action one tap away', async () => {
    mockApi()
    renderHome()
    const cta = await screen.findByRole('button', {
      name: /keep your first recipe/i,
    })
    await userEvent.click(cta)
    expect(await screen.findByText('add page')).toBeInTheDocument()
  })
})

describe('Home — first run, holding a handed-down recipe', () => {
  it('leads with the recipe they were sent, not "add your first recipe"', async () => {
    // The headline case: they followed a texted link, signed up to keep the
    // recipe, and Home used to greet them as if they had nothing.
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/someone passed you a/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Braised pork belly')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /keep your first recipe/i }),
    ).not.toBeInTheDocument()
  })

  it('does not show the abstract sample when it has a real recipe to show', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText('Braised pork belly')).toBeInTheDocument(),
    )
    // Their own recipe teaches better than the illustration.
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
  })

  it('offers authoring second, as an invitation rather than a demand', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/got one of your own/i)).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /keep a recipe/i }))
    expect(await screen.findByText('add page')).toBeInTheDocument()
  })

  it('opens the handed recipe when tapped', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await userEvent.click(
      await screen.findByRole('button', { name: /braised pork belly/i }),
    )
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })
})

describe('Home — returning user', () => {
  it('drops the explanation entirely once a recipe is kept (no nagging)', async () => {
    mockApi({ mine: [OWNED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/what.s cooking/i)).toBeInTheDocument(),
    )
    // Nothing to dismiss and nothing that reappears: the pitch is a property of
    // having nothing, so it cannot come back once they have something.
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
    expect(screen.queryByText(/really made/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/got one of your own/i)).not.toBeInTheDocument()
  })

  it('keeps recipes passed to them visible on Home, above the public feed', async () => {
    // Before: once a recipient added a recipe of their own, the recipe they
    // joined issei for disappeared from Home entirely.
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText('Braised pork belly')).toBeInTheDocument(),
    )
    const passed = screen.getByRole('button', { name: /passed to you/i })
    await userEvent.click(passed)
    expect(await screen.findByText('shared page')).toBeInTheDocument()
  })

  it('waits for the shared answer before deciding the kitchen is empty', async () => {
    // A race here would flash "add your first recipe" at someone who was just
    // handed one — the worst possible first frame.
    let release
    getSharedWithMe.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ data: [HANDED] })
      }),
    )
    client.get.mockResolvedValue({ data: [] })
    renderHome()
    await waitFor(() => expect(client.get).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: /keep your first recipe/i }),
    ).not.toBeInTheDocument()
    release()
    await waitFor(() =>
      expect(screen.getByText(/someone passed you a/i)).toBeInTheDocument(),
    )
  })

  it('still renders when the shared lookup fails', async () => {
    mockApi({ mine: [OWNED] })
    getSharedWithMe.mockRejectedValue(new Error('offline'))
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/what.s cooking/i)).toBeInTheDocument(),
    )
  })
})
