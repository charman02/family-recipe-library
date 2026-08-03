import { describe, it, expect } from 'vitest'
import {
  REAL_UNITS,
  FOLK_CHIP_UNITS,
  shouldOfferUnits,
  appendUnit,
} from './amountChips'
import { parseQuantity } from '../utils/quantity'

describe('unit chip vocabulary', () => {
  it('offers real units', () => {
    expect(REAL_UNITS.map((u) => u.label)).toEqual([
      'tsp',
      'tbsp',
      'cup',
      'g',
      'kg',
      'ml',
      'oz',
      'lb',
    ])
  })

  it('offers folk units alongside them, not tucked away', () => {
    expect(FOLK_CHIP_UNITS.map((u) => u.label)).toContain('soup spoon')
    expect(FOLK_CHIP_UNITS.map((u) => u.label)).toContain('pinch')
    expect(FOLK_CHIP_UNITS.map((u) => u.label)).toContain('handful')
  })

  it('produces amounts the parser reads as imprecise for EVERY folk chip', () => {
    // The contract that makes the chips safe: a tapped folk unit must classify
    // exactly as the same words typed by hand. A chip whose word this app's
    // parser didn't recognise would be tagged "precise" and then mathified by
    // the scaling engine — the one thing the product exists to refuse.
    for (const unit of FOLK_CHIP_UNITS) {
      expect(parseQuantity(appendUnit('2', unit)).quantity_type).toBe('imprecise')
      expect(parseQuantity(appendUnit('1', unit)).quantity_type).toBe('imprecise')
    }
  })

  it('produces amounts the parser reads as precise for every real chip', () => {
    for (const unit of REAL_UNITS) {
      expect(parseQuantity(appendUnit('2', unit)).quantity_type).toBe('precise')
    }
  })
})

describe('shouldOfferUnits', () => {
  it('offers units once a bare number is typed', () => {
    expect(shouldOfferUnits('2')).toBe(true)
    expect(shouldOfferUnits('1/2')).toBe(true)
    expect(shouldOfferUnits('1 1/2')).toBe(true)
    expect(shouldOfferUnits('0.5')).toBe(true)
    expect(shouldOfferUnits('3 ')).toBe(true)
  })

  it('stays out of the way before a number exists', () => {
    expect(shouldOfferUnits('')).toBe(false)
    expect(shouldOfferUnits('   ')).toBe(false)
    expect(shouldOfferUnits('a good splash')).toBe(false)
  })

  it('stays out of the way once a unit is already there', () => {
    // Whatever the user wrote is the answer; a strip under finished text is noise.
    expect(shouldOfferUnits('2 cups')).toBe(false)
    expect(shouldOfferUnits('3 soup spoons')).toBe(false)
    expect(shouldOfferUnits('2 c')).toBe(false)
  })
})

describe('appendUnit', () => {
  it('appends the unit after the number', () => {
    expect(appendUnit('2', { label: 'tbsp', plural: null })).toBe('2 tbsp')
  })

  it('pluralizes above one so it reads like a person wrote it', () => {
    expect(appendUnit('3', { label: 'soup spoon', plural: 'soup spoons' })).toBe(
      '3 soup spoons',
    )
    expect(appendUnit('1', { label: 'soup spoon', plural: 'soup spoons' })).toBe(
      '1 soup spoon',
    )
  })

  it('keeps the singular for a fraction of one', () => {
    expect(appendUnit('1/2', { label: 'cup', plural: 'cups' })).toBe('1/2 cup')
    expect(appendUnit('1 1/2', { label: 'cup', plural: 'cups' })).toBe(
      '1 1/2 cups',
    )
  })

  it('NEVER overwrites a unit the user already typed', () => {
    // The backstop for the worst bug available on this surface: silently
    // rewriting the words this app exists to preserve.
    expect(appendUnit('2 handfuls', { label: 'cup', plural: 'cups' })).toBe(
      '2 handfuls',
    )
    expect(appendUnit('a good splash', { label: 'tsp', plural: null })).toBe(
      'a good splash',
    )
  })

  it('trims the surrounding whitespace it appends into', () => {
    expect(appendUnit(' 2 ', { label: 'tsp', plural: null })).toBe('2 tsp')
  })
})
