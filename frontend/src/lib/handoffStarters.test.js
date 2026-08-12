import { describe, it, expect } from 'vitest'
import { HANDOFF_STARTERS, defaultStarterKey } from './handoffStarters'

describe('handoffStarters', () => {
  it('offers two warm openers: "you\'d love this" and "I made this for you"', () => {
    // The "add the part I'm missing" starter was removed: it framed the handoff as
    // asking the recipient to complete the recipe, but a recipient can't edit, and
    // the sharing purpose is simply to give a personal dish to someone new to it.
    expect(HANDOFF_STARTERS.map((s) => s.key)).toEqual(['love', 'made'])
    expect(HANDOFF_STARTERS.find((s) => s.key === 'love').note).toMatch(
      /love this/i,
    )
    expect(HANDOFF_STARTERS.find((s) => s.key === 'made').note).toMatch(
      /made this for you/i,
    )
    // The removed framing must not creep back in.
    expect(HANDOFF_STARTERS.some((s) => /add the part|missing/i.test(s.note))).toBe(
      false,
    )
  })

  it('auto-selects nothing — the note is the sender\'s to choose', () => {
    expect(defaultStarterKey('Lola')).toBeNull()
    expect(defaultStarterKey(null)).toBeNull()
    expect(defaultStarterKey('')).toBeNull()
  })
})
