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
})
