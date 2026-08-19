import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AddChooser from './AddChooser'

function renderChooser() {
  return render(
    <MemoryRouter initialEntries={['/add']}>
      <Routes>
        <Route path="/add" element={<AddChooser />} />
        <Route path="/add/meal" element={<div>meal composer</div>} />
        <Route path="/add/recipe" element={<div>recipe form</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AddChooser', () => {
  it('offers both creation paths, meal first', () => {
    renderChooser()
    const share = screen.getByRole('button', { name: /share a meal/i })
    const keep = screen.getByRole('button', { name: /keep a recipe/i })
    expect(share).toBeInTheDocument()
    expect(keep).toBeInTheDocument()
    // Meal (the light everyday act) is offered above recipe.
    expect(share.compareDocumentPosition(keep) & 4).toBeTruthy()
  })

  it('routes to the meal composer', async () => {
    renderChooser()
    await userEvent.click(screen.getByRole('button', { name: /share a meal/i }))
    expect(await screen.findByText('meal composer')).toBeInTheDocument()
  })

  it('routes to the recipe form', async () => {
    renderChooser()
    await userEvent.click(screen.getByRole('button', { name: /keep a recipe/i }))
    expect(await screen.findByText('recipe form')).toBeInTheDocument()
  })
})
