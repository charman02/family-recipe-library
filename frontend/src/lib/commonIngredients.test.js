import { describe, it, expect } from 'vitest'
import {
  COMMON_INGREDIENTS,
  mergeSuggestions,
  matchIngredients,
} from './commonIngredients'

describe('COMMON_INGREDIENTS', () => {
  it('covers the Asian pantry this app was built for', () => {
    // Not decoration: if these aren't one or two keystrokes away, the autosuggest
    // is helping with the recipes the app is LEAST about.
    for (const staple of [
      'soy sauce',
      'fish sauce',
      'sesame oil',
      'rice vinegar',
      'gochugaru',
      'miso paste',
      'dashi',
      'ginger',
      'scallions',
    ]) {
      expect(COMMON_INGREDIENTS).toContain(staple)
    }
  })

  it('still carries universal staples so a non-Asian recipe is not second-class', () => {
    for (const staple of ['salt', 'butter', 'eggs', 'olive oil', 'sugar']) {
      expect(COMMON_INGREDIENTS).toContain(staple)
    }
  })

  it('stays a shortcut rather than a taxonomy', () => {
    // A list long enough to "cover everything" crowds out the user's own words
    // and still misses the thing in their hand.
    expect(COMMON_INGREDIENTS.length).toBeGreaterThan(100)
    expect(COMMON_INGREDIENTS.length).toBeLessThan(200)
  })

  it('holds no duplicates and no stray casing', () => {
    const lower = COMMON_INGREDIENTS.map((n) => n.toLowerCase())
    expect(new Set(lower).size).toBe(COMMON_INGREDIENTS.length)
    expect(lower).toEqual(COMMON_INGREDIENTS)
  })
})

describe('mergeSuggestions', () => {
  it("puts the user's own words ahead of the shipped list", () => {
    const merged = mergeSuggestions(['patis', 'calamansi'])
    expect(merged[0]).toBe('patis')
    expect(merged[1]).toBe('calamansi')
  })

  it('dedupes case-insensitively, keeping the user spelling', () => {
    const merged = mergeSuggestions(['Soy Sauce'])
    expect(merged.filter((n) => n.toLowerCase() === 'soy sauce')).toEqual([
      'Soy Sauce',
    ])
  })

  it('ignores blank and whitespace-only entries', () => {
    const merged = mergeSuggestions(['', '   ', 'patis'])
    expect(merged[0]).toBe('patis')
  })
})

describe('matchIngredients', () => {
  const pool = ['soy sauce', 'fish sauce', 'sesame oil', 'chicken thighs']

  it('offers nothing for an empty query', () => {
    expect(matchIngredients('', pool)).toEqual([])
  })

  it('ranks a prefix match ahead of a later-word match', () => {
    // Typing "so" should reach for "soy sauce", not "fish sauce".
    expect(matchIngredients('so', pool)[0]).toBe('soy sauce')
  })

  it('matches on a later word so "sauce" finds both sauces', () => {
    expect(matchIngredients('sauce', pool)).toEqual(['soy sauce', 'fish sauce'])
  })

  it('never matches mid-word — that reads as the app guessing', () => {
    expect(matchIngredients('hi', pool)).toEqual([])
  })

  it('offers nothing once the name is exactly typed', () => {
    // There's no completion left, and an open strip would push the next field
    // down for no reason.
    expect(matchIngredients('soy sauce', pool)).toEqual([])
    expect(matchIngredients('  Soy Sauce ', pool)).toEqual([])
  })

  it('finds an exact match even when many partials precede it', () => {
    // Guard against short-circuiting the scan once the match cap is hit: 'salt'
    // sits well past six 's' prefixes in the real list, and missing it would
    // leave the strip open under a finished name.
    expect(matchIngredients('salt', COMMON_INGREDIENTS)).toEqual([])
  })

  it('caps the list so it cannot become a wall of options', () => {
    expect(matchIngredients('s', COMMON_INGREDIENTS).length).toBeLessThanOrEqual(6)
  })
})
