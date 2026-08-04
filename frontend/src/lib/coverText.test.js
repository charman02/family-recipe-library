import { describe, it, expect } from 'vitest'
import { coverLine, coverField } from './coverText'

const r = (over = {}) => ({ id: 1, name: 'Dish', steps: [], ingredients: [], ...over })

describe('coverLine', () => {
  it('prefers a step remark — it is a whole thought on its own', () => {
    // An amount needs its ingredient name to make sense; a remark doesn't.
    const line = coverLine(
      r({
        steps: [{ voice_note: 'Do not crowd the pan.' }],
        ingredients: [
          { name: 'soy', quantity_text: '3 soup spoons', quantity_type: 'imprecise' },
        ],
      }),
    )
    expect(line).toEqual({ text: 'Do not crowd the pan.', kind: 'note' })
  })

  it('falls back to a folk amount, with the ingredient it belongs to', () => {
    const line = coverLine(
      r({
        ingredients: [
          { name: 'garlic', quantity_text: 'a whole head', quantity_type: 'imprecise' },
        ],
      }),
    )
    expect(line.text).toBe('a whole head of garlic')
  })

  it('never sets a measured amount as if it were a turn of phrase', () => {
    // "200 g" in big italic type would look like the app misunderstanding the one
    // feature it is built around.
    const line = coverLine(
      r({
        ingredients: [{ name: 'flour', quantity_text: '200 g', quantity_type: 'precise' }],
      }),
    )
    expect(line).toBeNull()
  })

  it('skips a remark too long to set at display size', () => {
    // Clamping it would read as truncated content, not as a pull quote.
    const long = 'x'.repeat(90)
    expect(coverLine(r({ steps: [{ voice_note: long }] }))).toBeNull()
  })

  it('reaches amounts inside ingredient sections', () => {
    const line = coverLine(
      r({
        ingredient_sections: [
          {
            ingredients: [
              { name: 'vinegar', quantity_text: 'a good splash', quantity_type: 'imprecise' },
            ],
          },
        ],
      }),
    )
    expect(line.text).toBe('a good splash of vinegar')
  })

  it('returns null for a recipe with nothing quotable', () => {
    expect(coverLine(r())).toBeNull()
    expect(coverLine(null)).toBeNull()
  })
})

describe('coverField', () => {
  it('is stable for a given recipe', () => {
    // The same dish must not change colour between the grid and its own page.
    expect(coverField({ id: 7 })).toBe(coverField({ id: 7 }))
  })
  it('varies across recipes so neighbours rarely match', () => {
    const fields = new Set([1, 2, 3, 4].map((id) => coverField({ id })))
    expect(fields.size).toBe(4)
  })
  it('survives a missing id', () => {
    expect(coverField(undefined)).toBeTruthy()
  })
})
