import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
// GardenBed mock: render title (if any) + each recipe name, so page-level tests
// assert grouping/behavior without the SVG/scroll internals.
vi.mock('../components/GardenBed', () => ({
  default: ({ title, recipes }) => (
    <div data-bed={title || 'search'}>
      {title && <h2>{title}</h2>}
      {recipes.map((r) => (
        <div key={r.id}>{r.name}</div>
      ))}
    </div>
  ),
}))
import client from '../api/client'
import MyRecipes from './MyRecipes'

beforeEach(() => {
  client.get.mockReset()
  client.get.mockResolvedValue({ data: [] }) // default: empty kitchen
})

describe('MyRecipes', () => {
  it('renders the garden header (not the cookbook "Kitchen")', () => {
    render(
      <MemoryRouter>
        <MyRecipes />
      </MemoryRouter>,
    )
    expect(screen.getByText('Your Garden')).toBeInTheDocument()
    expect(screen.queryByText('Your Kitchen')).not.toBeInTheDocument()
  })

  it('offers a "shared with you" entry that navigates to /shared', async () => {
    render(
      <MemoryRouter initialEntries={['/kitchen']}>
        <Routes>
          <Route path="/kitchen" element={<MyRecipes />} />
          <Route path="/shared" element={<div>shared page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    const link = screen.getByRole('button', { name: /shared with you/i })
    expect(link).toBeInTheDocument()
    await userEvent.click(link)
    expect(await screen.findByText('shared page')).toBeInTheDocument()
  })

  it('groups kept recipes into growth bands (the garden)', async () => {
    const { default: client } = await import('../api/client')
    client.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Seedling Stew', growth_stage: 'seed' },
        { id: 2, name: 'Old Faithful', growth_stage: 'tree' },
      ],
    })
    render(
      <MemoryRouter>
        <MyRecipes />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Needs tending')).toBeInTheDocument()
    expect(screen.getByText('Thriving')).toBeInTheDocument()
    expect(screen.getByText('Seedling Stew')).toBeInTheDocument()
    expect(screen.getByText('Old Faithful')).toBeInTheDocument()
    // no sapling → 'Growing' band header absent
    expect(screen.queryByText('Growing')).not.toBeInTheDocument()
  })

  it('searching shows one untitled bed of matches (plants, not a titled band)', async () => {
    client.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Adobo', growth_stage: 'tree' },
        { id: 2, name: 'Sinigang', growth_stage: 'seed' },
      ],
    })
    render(<MemoryRouter><MyRecipes /></MemoryRouter>)
    await screen.findByText('Adobo')
    await userEvent.type(screen.getByPlaceholderText('Search recipes'), 'adobo')
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(screen.queryByText('Sinigang')).not.toBeInTheDocument()
    // the search bed is untitled — no band headers while searching
    expect(screen.queryByText('Needs tending')).not.toBeInTheDocument()
    expect(screen.queryByText('Thriving')).not.toBeInTheDocument()
  })

  it('a search with no matches shows the no-match message', async () => {
    client.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Adobo', growth_stage: 'tree' }],
    })
    render(<MemoryRouter><MyRecipes /></MemoryRouter>)
    await screen.findByText('Adobo')
    await userEvent.type(screen.getByPlaceholderText('Search recipes'), 'zzz')
    expect(screen.getByText(/No plants match/i)).toBeInTheDocument()
  })
})
