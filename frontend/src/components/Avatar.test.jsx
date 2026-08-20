import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders the photo when a photoUrl is given', () => {
    render(<Avatar name="Lola Reyes" photoUrl="https://cdn.test/lola.jpg" />)
    const img = screen.getByRole('img', { name: /lola reyes/i })
    expect(img).toHaveAttribute('src', 'https://cdn.test/lola.jpg')
  })

  it('falls back to the first-letter monogram when there is no photo', () => {
    render(<Avatar name="Lola Reyes" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('uses "?" when there is neither a photo nor a name', () => {
    render(<Avatar />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies the monogram bg only in the fallback (photo ignores it)', () => {
    const { rerender } = render(<Avatar name="A" bg="bg-plum" />)
    expect(screen.getByText('A').className).toMatch(/bg-plum/)
    rerender(<Avatar name="A" photoUrl="https://cdn.test/a.jpg" bg="bg-plum" />)
    // The photo variant has no monogram letter to carry the bg.
    expect(screen.queryByText('A')).toBeNull()
  })
})
