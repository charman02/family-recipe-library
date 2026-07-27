import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
import client from '../api/client'
import MyRecipes from './MyRecipes'

beforeEach(() => {
  client.get.mockReset()
  client.get.mockResolvedValue({ data: [] }) // default: empty kitchen
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

  it('renders kept recipes as cards', async () => {
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

  it('search filters the kept recipes', async () => {
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
