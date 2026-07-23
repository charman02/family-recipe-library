// frontend/src/components/GardenBed.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import GardenBed from './GardenBed'

const recipes = [
  { id: 1, name: 'Adobo', growth_stage: 'tree', origin_attribution: 'Lola Remedios · Cebu' },
  { id: 2, name: 'Champorado', growth_stage: 'sprout' }, // no origin
]

function renderBed(props) {
  return render(
    <MemoryRouter initialEntries={['/my-recipes']}>
      <Routes>
        <Route path="/my-recipes" element={<GardenBed {...props} />} />
        <Route path="/recipes/:id" element={<div>RECIPE PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('GardenBed', () => {
  it('renders title + blurb when given', () => {
    renderBed({ title: 'Thriving', blurb: 'Full heirlooms.', recipes })
    expect(screen.getByText('Thriving')).toBeInTheDocument()
    expect(screen.getByText('Full heirlooms.')).toBeInTheDocument()
  })
  it('omits the title when not given (search-results bed)', () => {
    renderBed({ recipes })
    expect(screen.queryByText('Thriving')).not.toBeInTheDocument()
  })
  it('renders one plant per recipe with its name', () => {
    renderBed({ title: 'B', blurb: 'b', recipes })
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(screen.getByText('Champorado')).toBeInTheDocument()
  })
  it('shows "from {source}" only when origin is present', () => {
    renderBed({ title: 'B', blurb: 'b', recipes })
    expect(screen.getByText(/from Lola Remedios/)).toBeInTheDocument()
    expect(screen.queryByText(/from undefined/)).not.toBeInTheDocument()
  })
  it('navigates to the recipe page when a plant is tapped', () => {
    renderBed({ title: 'B', blurb: 'b', recipes })
    fireEvent.click(screen.getByRole('button', { name: /Adobo/ }))
    expect(screen.getByText('RECIPE PAGE')).toBeInTheDocument()
  })
  it('renders nothing when recipes is empty', () => {
    const { container } = renderBed({ title: 'B', blurb: 'b', recipes: [] })
    expect(container.querySelector('button')).toBeNull()
  })
})
