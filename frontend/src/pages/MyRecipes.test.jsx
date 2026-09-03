import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
vi.mock('../api/sharing', () => ({ getSharedWithMe: vi.fn(), getKept: vi.fn() }))
// Kitchen now has a Posts tab (#74) that lazy-loads the user's own posts.
vi.mock('../api/posts', () => ({ getUserPosts: vi.fn(() => Promise.resolve({ data: [] })) }))
import client from '../api/client'
import { getSharedWithMe, getKept } from '../api/sharing'
import { getUserPosts } from '../api/posts'
import MyRecipes from './MyRecipes'

beforeEach(() => {
  localStorage.setItem('issei_user', JSON.stringify({ id: 1, first_name: 'Me' }))
  client.get.mockReset()
  client.get.mockResolvedValue({ data: [] }) // default: empty kitchen
  getSharedWithMe.mockReset()
  getSharedWithMe.mockResolvedValue({ data: [] })
  getKept.mockReset()
  getKept.mockResolvedValue({ data: { recipes: [], unreachable_count: 0 } })
  getUserPosts.mockReset()
  getUserPosts.mockResolvedValue({ data: [] })
})

describe('MyRecipes', () => {
  it('renders the kitchen header (not the garden)', () => {
    render(
      <MemoryRouter>
        <MyRecipes />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: /your kitchen/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/your garden/i)).not.toBeInTheDocument()
  })

  it('reaches recipes people sent you via the Kept tab, not a separate page (#57)', async () => {
    // The old "Shared with you →" chip navigated to /shared. That page is retired:
    // handed-to-you recipes now sit beside the ones you kept, in the Kept tab.
    render(
      <MemoryRouter initialEntries={['/kitchen']}>
        <Routes>
          <Route path="/kitchen" element={<MyRecipes />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /shared with you/i })).toBeNull()
    expect(screen.getByRole('tab', { name: /kept/i })).toBeInTheDocument()
  })

  it('renders your own recipes as cards', async () => {
    client.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Adobo' },
        { id: 2, name: 'Sinigang' },
      ],
    })
    render(
      <MemoryRouter>
        <MyRecipes />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
    expect(screen.getByText('Sinigang')).toBeInTheDocument()
  })

  it('search filters your own recipes', async () => {
    client.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Adobo' },
        { id: 2, name: 'Sinigang' },
      ],
    })
    render(<MemoryRouter><MyRecipes /></MemoryRouter>)
    await screen.findByText('Adobo')
    await userEvent.type(screen.getByPlaceholderText('Search recipes'), 'adobo')
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(screen.queryByText('Sinigang')).not.toBeInTheDocument()
  })

  it('a search with no matches shows the no-match message', async () => {
    client.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Adobo' }],
    })
    render(<MemoryRouter><MyRecipes /></MemoryRouter>)
    await screen.findByText('Adobo')
    await userEvent.type(screen.getByPlaceholderText('Search recipes'), 'zzz')
    expect(screen.getByText(/No recipes match/i)).toBeInTheDocument()
  })
})

// ?person=X — where Home's "whose recipes live here" row lands. Without a filter
// here, tapping a face would open an unfiltered kitchen, which reads as a dead link.
describe('MyRecipes — filtered to one person', () => {
  const LOLA = {
    id: 1,
    name: 'Adobo',
    origin_attribution: 'Lola Remedios · Cebu',
  }
  const OTHER = { id: 2, name: 'Congee', origin_attribution: 'Tita Baby' }
  const HANDED = { id: 3, name: 'Pork belly', origin_attribution: 'Lola Remedios' }

  function renderAt(entry) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/my-recipes" element={<MyRecipes />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows only that person’s dishes and says so', async () => {
    client.get.mockResolvedValue({ data: [LOLA, OTHER] })
    renderAt('/my-recipes?person=Lola%20Remedios')
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
    expect(screen.queryByText('Congee')).toBeNull()
    expect(screen.getByText(/Everything from Lola Remedios/)).toBeInTheDocument()
  })

  it('includes a dish that person HANDED to you, not just ones you wrote down', async () => {
    // The person who sent you a recipe is the most important name in the app;
    // a filter that ignored handoffs would hide exactly the dish they sent.
    client.get.mockResolvedValue({ data: [LOLA] })
    getSharedWithMe.mockResolvedValue({ data: [HANDED] })
    renderAt('/my-recipes?person=Lola%20Remedios')
    expect(await screen.findByText('Pork belly')).toBeInTheDocument()
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
  })

  it('does not fetch handoffs for the unfiltered kitchen', async () => {
    // The unfiltered Recipes tab is what you WROTE; handed-to-you recipes are the
    // Kept tab's job, so neither the handoff nor the shelf fetch fires here.
    client.get.mockResolvedValue({ data: [LOLA] })
    renderAt('/my-recipes')
    expect(await screen.findByText('Adobo')).toBeInTheDocument()
    expect(getSharedWithMe).not.toHaveBeenCalled()
    expect(getKept).not.toHaveBeenCalled()
  })

  it('lets you clear the filter without leaving the page', async () => {
    client.get.mockResolvedValue({ data: [LOLA, OTHER] })
    renderAt('/my-recipes?person=Lola%20Remedios')
    await userEvent.click(
      await screen.findByRole('button', { name: /Lola Remedios ×/ }),
    )
    expect(await screen.findByText('Congee')).toBeInTheDocument()
    expect(screen.getByText(/Recipes you’ve written down/)).toBeInTheDocument()
  })

  it('search narrows WITHIN the person, it does not replace the filter', async () => {
    client.get.mockResolvedValue({
      data: [LOLA, { id: 9, name: 'Adobo', origin_attribution: 'Tita Baby' }],
    })
    renderAt('/my-recipes?person=Lola%20Remedios')
    await screen.findByText('Adobo')
    await userEvent.type(screen.getByPlaceholderText(/search recipes/i), 'Adobo')
    // Both are named Adobo; only Lola's may survive.
    expect(screen.getAllByText('Adobo')).toHaveLength(1)
  })

  it('says the filter is empty rather than claiming the kitchen is', async () => {
    client.get.mockResolvedValue({ data: [OTHER] })
    renderAt('/my-recipes?person=Ghost')
    expect(await screen.findByText(/Nothing from Ghost here/)).toBeInTheDocument()
    expect(screen.queryByText(/kitchen's empty/i)).toBeNull()
  })
})

// #74: the kitchen holds your posts too, on a Posts tab reachable via ?tab=posts.
describe('MyRecipes — posts tab', () => {
  function renderAt(entry) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/my-recipes" element={<MyRecipes />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('defaults to the recipes tab and does NOT fetch posts', async () => {
    client.get.mockResolvedValue({ data: [{ id: 1, name: 'Adobo' }] })
    renderAt('/my-recipes')
    await screen.findByText('Adobo')
    expect(getUserPosts).not.toHaveBeenCalled()
  })

  it('?tab=posts opens the posts tab and loads the user’s own posts', async () => {
    getUserPosts.mockResolvedValueOnce({
      data: [
        {
          id: 5,
          user_id: 1,
          author_first_name: 'Me',
          author_last_name: '',
          photo_url: 'https://img.test/x.jpg',
          dish_name: 'My meal',
          created_at: '2026-08-20T12:00:00Z',
        },
      ],
    })
    renderAt('/my-recipes?tab=posts')
    expect(await screen.findByText('My meal')).toBeInTheDocument()
    expect(getUserPosts).toHaveBeenCalledWith(1)
  })

  it('shows an empty state on the posts tab when there are none', async () => {
    getUserPosts.mockResolvedValueOnce({ data: [] })
    renderAt('/my-recipes?tab=posts')
    expect(await screen.findByText(/no posts yet/i)).toBeInTheDocument()
  })

  it('switching to Posts fetches, switching back to Recipes shows the grid', async () => {
    client.get.mockResolvedValue({ data: [{ id: 1, name: 'Adobo' }] })
    renderAt('/my-recipes')
    await screen.findByText('Adobo')
    await userEvent.click(screen.getByRole('tab', { name: /posts/i }))
    expect(getUserPosts).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByRole('tab', { name: /recipes/i }))
    expect(screen.getByText('Adobo')).toBeInTheDocument()
  })
})

// #57: the Kept tab — recipes in your kitchen that aren't yours. One shelf merging what
// people handed you with what you kept yourself, plus an honest count of what's gone.
describe('MyRecipes — kept tab (#57)', () => {
  function renderAt(entry) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/my-recipes" element={<MyRecipes />} />
          <Route path="/recipes/:id" element={<div>recipe page</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('?tab=kept loads the shelf and lists what is on it', async () => {
    getKept.mockResolvedValueOnce({
      data: {
        recipes: [
          { id: 7, name: 'Lola’s adobo', origin_attribution: 'Lola' },
          { id: 8, name: 'Kept sinigang' },
        ],
        unreachable_count: 0,
      },
    })
    renderAt('/my-recipes?tab=kept')
    expect(await screen.findByText('Lola’s adobo')).toBeInTheDocument()
    expect(screen.getByText('Kept sinigang')).toBeInTheDocument()
    expect(getKept).toHaveBeenCalled()
  })

  it('opens the COOK’s recipe page, not a copy of your own', async () => {
    getKept.mockResolvedValueOnce({
      data: { recipes: [{ id: 7, name: 'Lola’s adobo' }], unreachable_count: 0 },
    })
    renderAt('/my-recipes?tab=kept')
    await userEvent.click(await screen.findByText('Lola’s adobo'))
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })

  it('reports unreachable kept recipes as a bare count, never a dish name', async () => {
    getKept.mockResolvedValueOnce({
      data: { recipes: [{ id: 7, name: 'Still here' }], unreachable_count: 2 },
    })
    renderAt('/my-recipes?tab=kept')
    expect(
      await screen.findByText(/2 recipes aren’t available to you any more/i),
    ).toBeInTheDocument()
    // The copy must not name what went missing, nor assert which choice the cook made —
    // the same count covers restricted AND deleted, so it offers both possibilities.
    expect(screen.queryByText(/private|unfriend/i)).toBeNull()
  })

  it('singularises the unreachable line for one', async () => {
    getKept.mockResolvedValueOnce({ data: { recipes: [], unreachable_count: 1 } })
    renderAt('/my-recipes?tab=kept')
    expect(
      await screen.findByText(/1 recipe isn’t available to you any more/i),
    ).toBeInTheDocument()
  })

  it('shows an empty state that points at both ways things arrive', async () => {
    getKept.mockResolvedValueOnce({ data: { recipes: [], unreachable_count: 0 } })
    renderAt('/my-recipes?tab=kept')
    expect(await screen.findByText(/nothing kept yet/i)).toBeInTheDocument()
    expect(screen.getByText(/recipes people send you land here/i)).toBeInTheDocument()
  })

  it('switching to Kept fetches the shelf once', async () => {
    client.get.mockResolvedValue({ data: [{ id: 1, name: 'Adobo' }] })
    renderAt('/my-recipes')
    await screen.findByText('Adobo')
    expect(getKept).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('tab', { name: /kept/i }))
    expect(getKept).toHaveBeenCalledTimes(1)
    // Back and forth must not refetch — the shelf is cached for the visit.
    await userEvent.click(screen.getByRole('tab', { name: /recipes/i }))
    await userEvent.click(screen.getByRole('tab', { name: /kept/i }))
    expect(getKept).toHaveBeenCalledTimes(1)
  })
})
