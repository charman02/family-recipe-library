import { describe, it, expect } from 'vitest'
import { coverField } from './coverText'

// coverLine and splitAmount used to be tested here at length. They're gone — a real user
// read the pull-quote cover as "ingredients on the cover photo", which is the correct
// reading of display type in a photo-shaped frame. See CoverImage.jsx for the history and
// coverText.js for why the logic wasn't kept around for later.
//
// What those tests protected still matters and still has coverage: that an amount is
// never converted lives in lib/kitchenFacts.test.js (quotableLines refuses to quote a
// measured amount) and in the backend's tests/test_recipe_ai.py.

describe('coverField', () => {
  it('is stable for a given recipe', () => {
    // The same dish must not change colour between the grid and its own page — or, as a
    // shipped bug once did, when it gets handed to someone else.
    expect(coverField({ id: 7 })).toBe(coverField({ id: 7 }))
  })

  it('varies across recipes so neighbours rarely match', () => {
    const fields = new Set([1, 2, 3, 4].map((id) => coverField({ id })))
    expect(fields.size).toBe(4)
  })

  it('survives a missing id rather than throwing', () => {
    expect(coverField(undefined)).toBeTruthy()
    expect(coverField({})).toBeTruthy()
  })
})
