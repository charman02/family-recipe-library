import { describe, it, expect } from 'vitest'
import { defaultInviteMessage } from './inviteMessage'

describe('defaultInviteMessage', () => {
  it('speaks in the sender’s own voice and names the dish', () => {
    // First person on purpose: the message is shared from the sender's own texting
    // app, so it reads like them, not an app notification that names them.
    expect(defaultInviteMessage({ recipeName: 'Adobo' })).toBe(
      'Here’s my Adobo recipe — I wanted you to have it 💛',
    )
  })

  it('stays a clean sentence when the dish is unknown', () => {
    expect(defaultInviteMessage({})).toBe(
      'Here’s my recipe — I wanted you to have it 💛',
    )
    expect(defaultInviteMessage()).toBe(
      'Here’s my recipe — I wanted you to have it 💛',
    )
  })

  it('trims whitespace so a blank-but-present dish is treated as absent', () => {
    expect(defaultInviteMessage({ recipeName: '   ' })).toBe(
      'Here’s my recipe — I wanted you to have it 💛',
    )
  })

  it('never mentions audio — this is a message about passing a recipe', () => {
    // POSITIONING: the ban is app-wide. The message copy has no reason to imply
    // sound, and this guards against a future rewrite that does.
    const banned = /record|recording|\bvoice\b|audio|listen/i
    for (const args of [{ recipeName: 'Adobo' }, {}]) {
      expect(defaultInviteMessage(args)).not.toMatch(banned)
    }
  })
})
