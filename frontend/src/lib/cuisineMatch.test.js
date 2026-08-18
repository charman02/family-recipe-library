import { describe, it, expect } from 'vitest'
import { normalizeCuisine, matchesCuisine } from './cuisineMatch'

describe('normalizeCuisine', () => {
  it('lowercases and trims', () => {
    expect(normalizeCuisine('  Japanese ')).toBe('japanese')
  })
  it('strips trailing punctuation', () => {
    expect(normalizeCuisine('Japanese?')).toBe('japanese')
    expect(normalizeCuisine('Thai!!')).toBe('thai')
  })
  it('strips a trailing food/cuisine/dish/style word', () => {
    expect(normalizeCuisine('Japanese food')).toBe('japanese')
    expect(normalizeCuisine('Korean cuisine')).toBe('korean')
  })
  it('renders null/undefined as empty', () => {
    expect(normalizeCuisine(null)).toBe('')
    expect(normalizeCuisine(undefined)).toBe('')
  })
})

describe('matchesCuisine', () => {
  it('matches despite case, whitespace, and trailing punctuation', () => {
    // The reported bug: "Japanese?" should match the "Japanese" filter.
    expect(matchesCuisine('Japanese?', 'Japanese')).toBe(true)
    expect(matchesCuisine('japanese ', 'Japanese')).toBe(true)
    expect(matchesCuisine('Japanese food', 'Japanese')).toBe(true)
  })
  it('an empty filter matches everything', () => {
    expect(matchesCuisine('Japanese', '')).toBe(true)
    expect(matchesCuisine('', '')).toBe(true)
    expect(matchesCuisine(null, '')).toBe(true)
  })
  it('does not match a different cuisine', () => {
    expect(matchesCuisine('Korean', 'Japanese')).toBe(false)
  })
  it('does NOT fuzzy-match a typo (a misspelling is not the cuisine)', () => {
    // Deliberate: no edit-distance. "Japanse" is not "Japanese".
    expect(matchesCuisine('Japanse', 'Japanese')).toBe(false)
  })
  it('an empty recipe cuisine matches only the empty filter', () => {
    expect(matchesCuisine('', 'Japanese')).toBe(false)
    expect(matchesCuisine(null, 'Japanese')).toBe(false)
  })
})
