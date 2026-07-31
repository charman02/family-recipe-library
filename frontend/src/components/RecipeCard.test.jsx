import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecipeCard from './RecipeCard'

describe('RecipeCard', () => {
  it('renders the recipe name and a byline', () => {
    render(
      <RecipeCard
        recipe={{ id: 1, name: 'Adobo', author_full_name: 'Yoko M.' }}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(screen.getByText('Yoko M.')).toBeInTheDocument()
  })

  it('shows "from {source}" when there is a recorded origin', () => {
    render(
      <RecipeCard
        recipe={{
          id: 1,
          name: 'Adobo',
          author_full_name: 'Yoko M.',
          origin_attribution: 'Lola Remedios · Cebu',
        }}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText(/^from$/i)).toBeInTheDocument()
    expect(screen.getByText('Lola Remedios')).toBeInTheDocument()
  })

  // "kept by" was app jargon testers couldn't decode; with no recorded origin the
  // byline is now just the name, which reads as attribution on its own.
  it('falls back to the bare author name — no "kept by" verb — with no origin', () => {
    render(
      <RecipeCard
        recipe={{ id: 2, name: 'Fried Rice', author_full_name: 'Yoko M.' }}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Yoko M.')).toBeInTheDocument()
    expect(screen.queryByText(/kept by/i)).not.toBeInTheDocument()
  })
})
