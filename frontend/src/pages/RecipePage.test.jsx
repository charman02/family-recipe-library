import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))
import client from '../api/client'

const recipe = {
  id: 1, user_id: 9, name: 'Adobo',
  story: 'Her Sunday dish.', origin_attribution: 'Lola Remedios · Cebu',
  author_full_name: 'Lola Remedios', cover_photo_url: null,
  ingredients: [{ id: 1, name: 'Soy sauce', quantity_text: '1/2 cup', position: 0 }],
  ingredient_sections: [], steps: [{ id: 1, content: 'Simmer.', position: 0 }],
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/recipes/1']}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipePageDefault />} />
      </Routes>
    </MemoryRouter>,
  )
}
import RecipePageDefault from './RecipePage'

beforeEach(() => {
  localStorage.setItem('issei_user', JSON.stringify({ id: 1 }))
  client.get.mockResolvedValue({ data: recipe })
})

describe('RecipePage', () => {
  it('loads and renders the dish name and its readable body', async () => {
    renderAt()
    await waitFor(() => expect(screen.getByText('Adobo')).toBeTruthy())
    // The classic detail page shows the recipe body inline — ingredients + steps.
    expect(screen.getByText('Soy sauce')).toBeTruthy()
    expect(screen.getByText('Ingredients')).toBeTruthy()
    expect(screen.getByText('Simmer.')).toBeTruthy()
  })

  it('renders no plant/garden hero (kitchen look)', async () => {
    renderAt()
    await waitFor(() => screen.getByText('Adobo'))
    expect(document.querySelector('.plant')).toBeNull()
  })

  // "Pass it on" was undecodable and read as publishing; the owner action now
  // names its outcome.
  it('names the handoff action by what it produces, not "Pass it on"', async () => {
    localStorage.setItem('issei_user', JSON.stringify({ id: 9 })) // the owner
    renderAt()
    await waitFor(() => screen.getByText('Adobo'))
    expect(
      screen.getByRole('button', { name: /send this to someone/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/pass it on/i)).toBeNull()
  })

  // The owner surfaces used to be wrapped in explanatory italic sub-lines, which
  // made the page bottom read as prose with buttons embedded in it. The buttons
  // stand alone; the publish-fear reassurance lives on HandoffInvite, the next
  // screen, where it's actually load-bearing.
  it('leaves the owner buttons unwrapped by descriptor prose', async () => {
    localStorage.setItem('issei_user', JSON.stringify({ id: 9 })) // the owner
    renderAt()
    await waitFor(() => screen.getByRole('button', { name: /send this to someone/i }))
    expect(screen.getByRole('button', { name: /delete recipe/i })).toBeInTheDocument()
    expect(screen.queryByText(/doesn’t change who else can see it/i)).toBeNull()
    expect(screen.queryByText(/they get a link/i)).toBeNull()
    expect(screen.queryByText(/don’t have to go looking/i)).toBeNull()
  })
})
