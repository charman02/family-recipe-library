import { describe, it, expect } from 'vitest'
import { heroReason } from './heroReason'

// The heading's whole job is to be TRUE. A label that survives when its reason
// stops being true is worse than no label — it turns into decoration that lies.
const NOW = new Date('2026-08-04T12:00:00Z').getTime()
const days = (n) => new Date(NOW - n * 86400000).toISOString()

describe('heroReason', () => {
  it('leads with a recipe someone handed you — the whole point of the app', () => {
    const r = { id: 5, created_at: days(400) }
    expect(heroReason(r, { shared: [{ id: 5 }], now: NOW })).toBe('Waiting for you')
  })

  it('prefers "handed to you" over every other reason', () => {
    // A handed recipe that is ALSO freshly kept and previously cooked still reads
    // as handed: that's the strongest thing true about it.
    const r = { id: 5, created_at: days(1), last_cooked_at: days(2) }
    expect(heroReason(r, { shared: [{ id: 5 }], now: NOW })).toBe('Waiting for you')
  })

  it('invites a repeat once something has been cooked', () => {
    const r = { id: 1, created_at: days(300), last_cooked_at: days(3) }
    expect(heroReason(r, { now: NOW })).toBe('Cook it again')
  })

  it('calls a recipe kept this week freshly kept', () => {
    expect(heroReason({ id: 1, created_at: days(2) }, { now: NOW })).toBe(
      'Freshly kept',
    )
  })

  it('stops saying "freshly kept" once it is not fresh', () => {
    // The boundary is the point: a label that never expires is decoration.
    expect(heroReason({ id: 1, created_at: days(30) }, { now: NOW })).toBe(
      'From your kitchen',
    )
  })

  it('falls back to a claim that is always true', () => {
    expect(heroReason({ id: 1 }, { now: NOW })).toBe('From your kitchen')
  })

  it('never invents a reason for nothing', () => {
    expect(heroReason(null)).toBeNull()
  })

  it('makes no editorial claim', () => {
    // "Recipe of the week"/"of the day" would assert a judgement nobody made, and
    // a global pick would make issei a publication rather than a handoff.
    const labels = [
      heroReason({ id: 5 }, { shared: [{ id: 5 }], now: NOW }),
      heroReason({ id: 1, last_cooked_at: days(1) }, { now: NOW }),
      heroReason({ id: 1, created_at: days(1) }, { now: NOW }),
      heroReason({ id: 1 }, { now: NOW }),
    ]
    for (const l of labels) {
      expect(l).not.toMatch(/of the (day|week|month)|featured|trending|top pick/i)
    }
  })
})
