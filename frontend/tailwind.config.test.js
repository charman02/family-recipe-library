import { describe, it, expect } from 'vitest'
// ?raw pulls index.html in as a string, resolved relative to this file by Vite —
// no cwd assumptions, unlike fs + import.meta.url (which isn't a file: URL here).
import indexHtml from './index.html?raw'
import config from './tailwind.config.js'

describe('tailwind font families', () => {
  const fam = config.theme.extend.fontFamily
  it('serif is Cormorant Garamond', () => {
    expect(fam.serif[0]).toBe('Cormorant Garamond')
  })
  it('sans is Nunito Sans', () => {
    expect(fam.sans[0]).toBe('Nunito Sans')
  })
  // Pinning font NAMES just meant editing this test on every design change (the
  // story face went Caveat → Fraunces italic → Shantell → Patrick Hand →
  // Architects Daughter → Kalam → none). What breaks SILENTLY is a family the
  // app references but never loads: it falls back to a system face and nothing
  // errors. So assert that invariant, and derive the keys so retiring a family
  // doesn't leave a stale list behind.
  const IN_USE = Object.keys(fam).filter((k) => k !== 'serif') // serif is legacy + unloaded
  it('every font family the app uses is actually loaded in index.html', () => {
    // Google Fonts URLs join families with "+" for spaces.
    const loaded = (name) => indexHtml.includes(name.replace(/ /g, '+'))
    for (const key of IN_USE) {
      expect(loaded(fam[key][0]), `${fam[key][0]} (font-${key}) not in index.html`).toBe(true)
    }
  })

  it('no handwritten face — a script font is not used for body content', () => {
    // Five were tried and cut: the story and step remarks are content someone
    // cooks from, and the data is typed text, so a hand face costs legibility to
    // imply a recording that doesn't exist. See tailwind.config.js.
    expect(fam.hand).toBeUndefined()
  })
})

describe('tailwind color roles', () => {
  const c = config.theme.extend.colors
  it('action maps to terra', () => {
    expect(c.action).toBe('#B5502A')
    expect(c.action).toBe(c.terra)
  })
  it('growth maps to the lead green', () => {
    expect(c.growth).toBe('#5C7A3F')
    expect(c.growth).toBe(c.herb)
  })
  it('uses the garden palette', () => {
    expect(c.paper).toBe('#F3EAD6')
    expect(c.terra).toBe('#B5502A')
    expect(c.herb).toBe('#5C7A3F')
  })
})
