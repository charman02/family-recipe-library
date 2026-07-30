import { describe, it, expect } from 'vitest'
import { parseQuantity } from './quantity'

// The app exists to refuse to mathify how people actually cook. Until now the
// classifier only knew hedge ADVERBS ("~", "about", "roughly"), so an amount
// survived as imprecise only when it had no leading digit at all — which meant
// "3 soup spoons", the README's own flagship example, was filed as PRECISE and
// scaled arithmetically. These tests pin the folk-unit vocabulary that fixes it.

describe('parseQuantity — folk units are imprecise', () => {
  it('classifies the README flagship examples as imprecise', () => {
    expect(parseQuantity('3 soup spoons').quantity_type).toBe('imprecise')
    expect(parseQuantity('a dash').quantity_type).toBe('unmeasured')
    expect(parseQuantity('a dash of fish sauce').quantity_type).toBe('unmeasured')
  })

  it('classifies body and vessel measures as imprecise', () => {
    const folk = [
      '1 pinch',
      '2 handfuls',
      '3 glugs',
      'a good splash',
      '1 dash',
      '2 knobs of butter',
      '1 drizzle',
      '3 fingers of water',
      '1 rice cooker cup',
      '2 soup spoons',
      '1 heaping tablespoon',
      '2 scant teaspoons',
      '1 wineglass',
      '3 drops',
      '1 sprinkle',
      '2 smidgens',
    ]
    for (const raw of folk) {
      const { quantity_type } = parseQuantity(raw)
      expect(
        ['imprecise', 'unmeasured'],
        `"${raw}" should not be precise`,
      ).toContain(quantity_type)
    }
  })

  it('keeps the number when a folk unit is counted', () => {
    // "3 soup spoons" is 3 of something fuzzy — the COUNT is real even though
    // the vessel isn't, so the value survives for scaling. The text is verbatim.
    const q = parseQuantity('3 soup spoons')
    expect(q.quantity_value).toBe(3)
    expect(q.unit).toBe('soup spoons')
    expect(q.quantity_text).toBe('3 soup spoons')
  })

  it('matches folk units regardless of case, plural, or surrounding words', () => {
    expect(parseQuantity('2 SOUP SPOONS').quantity_type).toBe('imprecise')
    expect(parseQuantity('1 Pinch of salt').quantity_type).toBe('imprecise')
    expect(parseQuantity('2 handfuls of scallions').quantity_type).toBe('imprecise')
  })
})

describe('parseQuantity — real measurements stay precise', () => {
  it('does not treat standard units as folk units', () => {
    const precise = [
      '2 lbs',
      '1 cup',
      '3 tbsp',
      '2 tsp',
      '500 g',
      '1 kg',
      '2 oz',
      '250 ml',
      '1 l',
      '1 1/2 cups',
      '2.5 cups',
      '3',
    ]
    for (const raw of precise) {
      const { quantity_type } = parseQuantity(raw)
      expect(quantity_type, `"${raw}" should be precise`).toBe('precise')
    }
  })

  it('does not let a folk word inside an ingredient name flip the type', () => {
    // "tablespoon" contains no folk marker; "spoonful" does. Guard against a
    // substring match turning a real unit fuzzy.
    expect(parseQuantity('1 tablespoon').quantity_type).toBe('precise')
    expect(parseQuantity('2 teaspoons').quantity_type).toBe('precise')
  })
})

describe('parseQuantity — hedge adverbs still work', () => {
  it('keeps treating hedged amounts as imprecise', () => {
    expect(parseQuantity('~3 tbsp').quantity_type).toBe('imprecise')
    expect(parseQuantity('about 2 cups').quantity_type).toBe('imprecise')
    expect(parseQuantity('roughly 1 cup').quantity_type).toBe('imprecise')
    expect(parseQuantity('approximately 500 g').quantity_type).toBe('imprecise')
  })

  it('strips the hedge so the number still parses', () => {
    expect(parseQuantity('~3 tbsp').quantity_value).toBe(3)
    expect(parseQuantity('about 2 cups').quantity_value).toBe(2)
  })
})

describe('parseQuantity — unmeasured', () => {
  it('treats an amount with no number as unmeasured', () => {
    expect(parseQuantity('to taste').quantity_type).toBe('unmeasured')
    expect(parseQuantity('until it smells right').quantity_type).toBe('unmeasured')
    expect(parseQuantity('').quantity_type).toBe('unmeasured')
    expect(parseQuantity(null).quantity_type).toBe('unmeasured')
  })

  it('drops the unit on unmeasured amounts', () => {
    expect(parseQuantity('to taste').unit).toBeNull()
    expect(parseQuantity('to taste').quantity_value).toBeNull()
  })
})

describe('parseQuantity — numbers', () => {
  it('parses mixed numbers, fractions, decimals, and unicode fractions', () => {
    expect(parseQuantity('1 1/2 cups').quantity_value).toBe(1.5)
    expect(parseQuantity('1/2 cup').quantity_value).toBe(0.5)
    expect(parseQuantity('2.5 cups').quantity_value).toBe(2.5)
    expect(parseQuantity('1½ cups').quantity_value).toBe(1.5)
    expect(parseQuantity('½ cup').quantity_value).toBe(0.5)
  })

  it('always keeps the raw text verbatim', () => {
    expect(parseQuantity('  1 1/2 cups  ').quantity_text).toBe('1 1/2 cups')
    expect(parseQuantity('a good splash').quantity_text).toBe('a good splash')
  })
})
