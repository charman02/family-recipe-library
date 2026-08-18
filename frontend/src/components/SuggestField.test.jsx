import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import SuggestField from './SuggestField'

// A controlled host so value changes round-trip through real state, the way the
// recipe form uses it. (No Web Speech API in jsdom, so the mic renders nothing —
// same as production Firefox; these tests are about the suggestion strip.)
function Host({ suggestions = ['Japanese', 'Korean', 'Filipino'], initial = '' }) {
  const [value, setValue] = useState(initial)
  return (
    <SuggestField
      id="f"
      value={value}
      onChange={setValue}
      suggestions={suggestions}
      placeholder="Filipino"
      label="the cuisine"
      listLabel="Cuisines"
    />
  )
}

const field = () => screen.getByRole('combobox')
const type = (v) => {
  fireEvent.focus(field())
  fireEvent.change(field(), { target: { value: v } })
}

describe('SuggestField', () => {
  it('is a combobox, closed until typing matches', () => {
    render(<Host />)
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('suggests by prefix as you type', () => {
    render(<Host />)
    type('Jap')
    expect(screen.getByRole('option', { name: 'Japanese' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Korean' })).toBeNull()
  })

  it('tapping a suggestion fills the field', () => {
    render(<Host />)
    type('Ko')
    fireEvent.click(screen.getByRole('option', { name: 'Korean' }))
    expect(field()).toHaveValue('Korean')
  })

  it('does not blur on pointer-down (keeps the keyboard up)', () => {
    render(<Host />)
    type('Jap')
    const ev = fireEvent.mouseDown(screen.getByRole('option', { name: 'Japanese' }))
    expect(ev).toBe(false) // preventDefault was called
  })

  it('arrow + Enter accepts a highlighted suggestion', () => {
    render(<Host />)
    type('Jap')
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(field()).toHaveValue('Japanese')
  })

  it('Escape closes the strip and it stays closed while typing', () => {
    render(<Host />)
    type('Ja')
    expect(screen.getByRole('option', { name: 'Japanese' })).toBeInTheDocument()
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    fireEvent.change(field(), { target: { value: 'Jap' } })
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('accepts free text no list has heard of', () => {
    render(<Host />)
    type('Peruvian')
    expect(screen.queryByRole('option')).toBeNull()
    expect(field()).toHaveValue('Peruvian')
  })

  it('closes the strip once the value exactly matches a suggestion', () => {
    render(<Host />)
    type('Japanese')
    expect(screen.queryByRole('option')).toBeNull()
  })
})
