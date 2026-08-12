import { describe, it, expect } from 'vitest'
import { sourceNameOf, originPartsOf } from './sourceName'

describe('sourceNameOf', () => {
  it('returns the leading name segment of origin_attribution', () => {
    expect(
      sourceNameOf({ origin_attribution: 'Lola Remedios · Cebu · 1950s' }),
    ).toBe('Lola Remedios')
  })
  it('handles a bare name with no separators', () => {
    expect(sourceNameOf({ origin_attribution: 'Mom' })).toBe('Mom')
  })
  it('returns null when there is no origin', () => {
    expect(sourceNameOf({ origin_attribution: null })).toBeNull()
    expect(sourceNameOf({})).toBeNull()
  })
})

describe('originPartsOf', () => {
  it('splits name · place · year into parts', () => {
    expect(
      originPartsOf({ origin_attribution: 'Lola Remedios · Cebu · 1950s' }),
    ).toEqual({ name: 'Lola Remedios', place: 'Cebu', year: '1950s' })
  })
  it('fills missing segments with empty strings', () => {
    expect(originPartsOf({ origin_attribution: 'Mom' })).toEqual({
      name: 'Mom',
      place: '',
      year: '',
    })
    expect(originPartsOf({ origin_attribution: 'Mom · Manila' })).toEqual({
      name: 'Mom',
      place: 'Manila',
      year: '',
    })
  })
  it('returns all-empty parts when there is no origin', () => {
    expect(originPartsOf({ origin_attribution: null })).toEqual({
      name: '',
      place: '',
      year: '',
    })
    expect(originPartsOf({})).toEqual({ name: '', place: '', year: '' })
  })
})
