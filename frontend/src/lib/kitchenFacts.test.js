import { describe, it, expect } from 'vitest'
import {
  personOf,
  shortName,
  peopleInKitchen,
  quotableLines,
  lineOfTheDay,
  unfinished,
  kitchenGlance,
} from './kitchenFacts'

const r = (over = {}) => ({
  id: Math.random(),
  name: 'Dish',
  steps: [],
  ingredients: [],
  ingredient_sections: [],
  ...over,
})

describe('personOf', () => {
  it('prefers the recorded source over whoever typed it in', () => {
    // The byline rule everywhere else: the dish came FROM Lola, even though Mia
    // is the account that wrote it down.
    expect(
      personOf(r({ origin_attribution: 'Lola · Cebu', author_full_name: 'Mia' })),
    ).toBe('Lola')
  })
  it('falls back to the author when nobody was recorded', () => {
    expect(personOf(r({ author_full_name: 'Mia' }))).toBe('Mia')
  })
  it('returns null rather than an empty string', () => {
    expect(personOf(r())).toBeNull()
  })
})

describe('shortName', () => {
  it('drops the honorific and keeps the actual name', () => {
    // Caught on screen: the avatar row rendered "Auntie Ling" as A / Auntie and
    // "Tita Baby" as T / Tita, so every auntie in a kitchen looked identical.
    expect(shortName('Auntie Ling')).toBe('Ling')
    expect(shortName('Tita Baby')).toBe('Baby')
    expect(shortName('Lola Remedios')).toBe('Remedios')
  })

  it('keeps a bare honorific, because that IS what they are called', () => {
    // "Lola" on its own is the name in that family. Stripping it would leave nothing.
    expect(shortName('Lola')).toBe('Lola')
    expect(shortName('Grandma')).toBe('Grandma')
  })

  it('is case- and punctuation-insensitive about the title', () => {
    expect(shortName('AUNTIE Ling')).toBe('Ling')
    expect(shortName('Mrs. Kim')).toBe('Kim')
  })

  it('leaves an ordinary name alone', () => {
    expect(shortName('Mia Chen')).toBe('Mia')
  })

  it('handles nothing without throwing', () => {
    expect(shortName(null)).toBe('')
    expect(shortName('   ')).toBe('')
  })
})

describe('peopleInKitchen', () => {
  it('groups recipes by the person they came from, busiest first', () => {
    const people = peopleInKitchen([
      r({ origin_attribution: 'Lola · Cebu' }),
      r({ origin_attribution: 'Lola · Cebu' }),
      r({ author_full_name: 'Mia' }),
    ])
    expect(people.map((p) => [p.name, p.count])).toEqual([
      ['Lola', 2],
      ['Mia', 1],
    ])
  })
  it('breaks ties alphabetically so the row does not reshuffle', () => {
    const people = peopleInKitchen([
      r({ author_full_name: 'Zoe' }),
      r({ author_full_name: 'Abe' }),
    ])
    expect(people.map((p) => p.name)).toEqual(['Abe', 'Zoe'])
  })
  it('skips recipes with nobody attached', () => {
    expect(peopleInKitchen([r()])).toEqual([])
  })
})

describe('quotableLines', () => {
  const rich = r({
    origin_attribution: 'Lola · Cebu',
    steps: [
      { id: 1, content: 'Brown it.', voice_note: 'Do not crowd the pan.' },
      { id: 2, content: 'Simmer.' },
    ],
    ingredients: [
      { id: 1, name: 'soy', quantity_text: '3 soup spoons', quantity_type: 'imprecise' },
      { id: 2, name: 'flour', quantity_text: '200 g', quantity_type: 'precise' },
    ],
  })

  it('collects step notes and imprecise amounts, attributed', () => {
    const lines = quotableLines([rich])
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.person === 'Lola')).toBe(true)
  })

  it('never quotes a measured amount as if it were someone words', () => {
    // "200 g" is not a turn of phrase — quoting it would make the feature look
    // like it doesn't understand its own point.
    const lines = quotableLines([rich])
    expect(lines.some((l) => l.text === '200 g')).toBe(false)
  })

  it('reaches amounts inside ingredient sections too', () => {
    const lines = quotableLines([
      r({
        ingredient_sections: [
          {
            ingredients: [
              { id: 9, name: 'vinegar', quantity_text: 'a good splash', quantity_type: 'imprecise' },
            ],
          },
        ],
      }),
    ])
    expect(lines[0].text).toBe('a good splash')
  })
})

describe('lineOfTheDay', () => {
  it('is stable within a day and different the next', () => {
    // Math.random() would reshuffle on every re-render — the card would flicker
    // while scrolling, and the behaviour could not be tested.
    const lines = [{ text: 'a' }, { text: 'b' }, { text: 'c' }]
    const day = 86400000
    const t = 1000 * day
    expect(lineOfTheDay(lines, t)).toBe(lineOfTheDay(lines, t + 3600000))
    expect(lineOfTheDay(lines, t)).not.toBe(lineOfTheDay(lines, t + day))
  })
  it('returns null with nothing to quote', () => {
    expect(lineOfTheDay([])).toBeNull()
  })
})

describe('unfinished', () => {
  it('ranks gaps by what they cost a RECIPIENT, not by field order', () => {
    // A recipe with no steps cannot be cooked; a missing photo is cosmetic. The
    // nudge exists because a richer recipe makes a better handoff.
    const noPhoto = r({ name: 'NoPhoto', story: 's', steps: [{ voice_note: 'n' }] })
    const noSteps = r({ name: 'NoSteps', story: 's' })
    const out = unfinished([noPhoto, noSteps])
    expect(out[0].recipe.name).toBe('NoSteps')
    expect(out[0].gap).toBe('steps')
  })

  it('does not nag about missing notes on a recipe with no steps at all', () => {
    // Otherwise the same recipe appears for two reasons and the list reads broken.
    const out = unfinished([r({ name: 'Empty' })])
    expect(out).toHaveLength(1)
    expect(out[0].gap).toBe('steps')
  })

  it('leaves a complete recipe alone', () => {
    const done = r({
      story: 'A story.',
      cover_photo_url: 'x.jpg',
      steps: [{ content: 'Do it.', voice_note: 'gently' }],
    })
    expect(unfinished([done])).toEqual([])
  })

  it('caps the list so Home never becomes a chore sheet', () => {
    expect(unfinished([r(), r(), r(), r(), r()]).length).toBe(3)
  })
})

describe('kitchenGlance', () => {
  it('counts recipes, people and cooks', () => {
    const g = kitchenGlance([
      r({ origin_attribution: 'Lola · Cebu', cook_count: 2 }),
      r({ author_full_name: 'Mia', cook_count: 1 }),
    ])
    expect(g).toMatchObject({ recipes: 2, people: 2, cooks: 3 })
  })

  it('counts THEIR WORDS — the amounts and remarks nobody rounded off', () => {
    // The one number here no other recipe app could print, because they all
    // convert these to grams on the way in. It's the third stat pill.
    const g = kitchenGlance([
      r({
        steps: [{ voice_note: 'Do not crowd the pan.' }],
        ingredients: [
          { name: 'soy', quantity_text: '3 soup spoons', quantity_type: 'imprecise' },
          { name: 'flour', quantity_text: '200 g', quantity_type: 'precise' },
        ],
      }),
    ])
    expect(g.theirWords).toBe(2) // the note + the folk amount, NOT the 200 g
  })

  it('reports zero cooks rather than guessing', () => {
    // cook_count is 0 for every real user right now (nothing calls the cook
    // endpoint — task #32), so the caller decides whether to show it.
    expect(kitchenGlance([r()]).cooks).toBe(0)
  })
})
