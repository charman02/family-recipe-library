import { describe, it, expect } from 'vitest'
import { parseRecipeText, splitAmount } from './parseRecipeText'

describe('parseRecipeText — the four inputs this was measured against', () => {
  it('a list typed into Notes, with no headers at all', () => {
    const r = parseRecipeText(`chicken adobo
3 soup spoons soy sauce
a good splash of cane vinegar
a whole head of garlic
2 bay leaves
brown the chicken skin-side down
add the soy and vinegar and let it bubble
simmer until the sauce coats a spoon`)
    expect(r.name).toBe('chicken adobo')
    expect(r.ingredients.map((i) => i.name)).toEqual([
      'soy sauce',
      'cane vinegar',
      'garlic',
      'bay leaves',
    ])
    expect(r.steps).toHaveLength(3)
  })

  it('obeys the author’s own headers instead of guessing', () => {
    // "sugar to taste" has no amount and no verb — inference filed it as a step. A
    // header is the author's own classification, so it wins outright.
    const r = parseRecipeText(`Champorado
Ingredients:
1 cup glutinous rice
a good heap of cocoa
sugar to taste
Instructions:
1. Boil the rice until soft
2. Stir in the cocoa`)
    expect(r.usedHeaders).toBe(true)
    expect(r.guessedLines).toBe(0)
    expect(r.ingredients.map((i) => i.name)).toEqual([
      'glutinous rice',
      'cocoa',
      'sugar to taste',
    ])
    expect(r.steps).toEqual(['Boil the rice until soft', 'Stir in the cocoa'])
  })

  it('reads a run of bare nouns as the ingredient list', () => {
    // The grandma-style input: no amounts, no verbs, just what goes in. One bare noun
    // is ambiguous; four in a row are a list.
    const r = parseRecipeText(`Tinola
ginger
chicken
green papaya
fish sauce
saute the ginger
add chicken, brown it
pour water and simmer`)
    expect(r.ingredients.map((i) => i.name)).toEqual([
      'ginger',
      'chicken',
      'green papaya',
      'fish sauce',
    ])
    expect(r.steps).toHaveLength(3)
  })

  it('keeps a lone bare noun with the amounts it sits beside', () => {
    // Caught in a real browser, not by a unit test: this exact paste filed "tamarind"
    // as Step 1, because a single bare noun isn't a "run" of three. But it sits
    // directly under four amount-led ingredients — nobody writes a list and then a
    // one-word instruction.
    const r = parseRecipeText(`Sinigang na Baboy
1 kg pork belly
a thumb of ginger
3 soup spoons fish sauce
a bunch of kangkong
tamarind
Boil the pork until tender
Add the tamarind and simmer`)
    expect(r.ingredients.map((i) => i.name)).toEqual([
      'pork belly',
      'ginger',
      'fish sauce',
      'kangkong',
      'tamarind',
    ])
    expect(r.steps).toHaveLength(2)
  })

  it('does NOT pretend to handle dictated run-on prose', () => {
    // One spoken sentence holds three ingredients. No line-based rule can split it,
    // and claiming otherwise would be worse than not offering it — the user would
    // proofread a wrong answer. This is why paste is an optional door.
    const r = parseRecipeText(`sinigang
you need tamarind, about a thumb of ginger, and some kangkong
first you boil the pork until tender
then add the tamarind`)
    expect(r.ingredients).toHaveLength(0)
    expect(r.guessedLines).toBeGreaterThan(0) // caller must warn
  })
})

describe('parseRecipeText — structure', () => {
  it('takes the first line as the dish name', () => {
    expect(parseRecipeText('Adobo\n2 cups rice').name).toBe('Adobo')
  })

  it('leaves the name empty when the paste starts with a header', () => {
    // Pasting from a section of a page: the dish name isn't in the text, so inventing
    // one from "Ingredients:" would be worse than leaving the field for the user.
    const r = parseRecipeText('Ingredients:\n2 cups rice\nBoil it')
    expect(r.name).toBe('')
    expect(r.ingredients).toHaveLength(1)
  })

  it('strips bullets and numbering without eating the words', () => {
    const r = parseRecipeText(`Adobo
- 2 cups rice
* a dash of salt
1. Boil the rice
2) Season it`)
    expect(r.ingredients.map((i) => i.name)).toEqual(['rice', 'salt'])
    expect(r.steps).toEqual(['Boil the rice', 'Season it'])
  })

  it('keeps an amount that only looks like numbering', () => {
    // "2 tbsp" must not be mistaken for the ordinal "2." — the ORDINAL pattern
    // requires the dot/paren, so this survives intact.
    const r = parseRecipeText('Adobo\n2 tbsp soy sauce')
    expect(r.ingredients[0]).toMatchObject({ amount: '2 tbsp', name: 'soy sauce' })
  })

  it('reports nothing rather than throwing on empty input', () => {
    for (const input of ['', '   \n  \n', null, undefined]) {
      const r = parseRecipeText(input)
      expect(r.ingredients).toEqual([])
      expect(r.steps).toEqual([])
    }
  })

  it('files ambiguous prose as a step, the safer wrong answer', () => {
    // A mis-filed step still reads as a sentence; a mis-filed ingredient is nonsense.
    const r = parseRecipeText(
      'Adobo\nthis is the way my mother always made it on Sundays',
    )
    expect(r.steps).toHaveLength(1)
    expect(r.ingredients).toHaveLength(0)
  })
})

describe('splitAmount — imprecision survives the parse', () => {
  it('keeps a folk amount verbatim and typed imprecise', () => {
    // The whole product rests on this. A parser that turned "3 soup spoons" into
    // 45ml would delete the only part that was actually theirs.
    expect(splitAmount('3 soup spoons soy sauce')).toEqual({
      amount: '3 soup spoons',
      name: 'soy sauce',
      quantity_type: 'imprecise',
    })
  })

  it('splits on "of", the reliable hinge', () => {
    // quantity_type is `unmeasured`, not `imprecise` — and that's correct, not a bug
    // here. parseQuantity reserves `imprecise` for a countable amount that could scale
    // ("3 soup spoons" → 6), while "a good splash" has no number to scale at all, so it
    // stays verbatim forever. Both preserve the words; only the scaling differs.
    expect(splitAmount('a good splash of cane vinegar')).toEqual({
      amount: 'a good splash',
      name: 'cane vinegar',
      quantity_type: 'unmeasured',
    })
  })

  it('still calls a real measurement precise', () => {
    expect(splitAmount('200 g flour')).toEqual({
      amount: '200 g',
      name: 'flour',
      quantity_type: 'precise',
    })
  })

  it('treats a bare count as the amount, not as a unit', () => {
    expect(splitAmount('2 bay leaves')).toMatchObject({
      amount: '2',
      name: 'bay leaves',
    })
  })

  it('accepts an ingredient with no amount at all', () => {
    // "ginger" is a legitimate line in a real recipe, not a parse failure.
    expect(splitAmount('ginger')).toEqual({
      amount: '',
      name: 'ginger',
      quantity_type: 'unmeasured',
    })
  })

  it('handles a unicode fraction', () => {
    expect(splitAmount('½ cup sugar')).toMatchObject({
      amount: '½ cup',
      name: 'sugar',
    })
  })
})
