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
  it('has no dead colours left from the garden UI', () => {
    // paper/herb/growth/growth-bright/soil were the plant UI's palette and had
    // ZERO uses after the kitchen redesign. A colour nobody uses is an invitation
    // to reach for an abandoned design, so they're deleted rather than deprecated.
    for (const dead of ['paper', 'herb', 'growth', 'growth-bright', 'soil']) {
      expect(c[dead], `${dead} should be deleted, not kept`).toBeUndefined()
    }
  })

  it('is ONE warm family — no cool hues', () => {
    // periwinkle (#6E7BF2, hue 234) was the only cool colour in the app and it
    // fought everything around it. Every accent now sits in the warm band, which
    // is both what makes the app read as one object and the right register for
    // food — blue is the classic appetite suppressant.
    expect(c.periwinkle).toBeUndefined()
    const hue = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max === min) return 0
      const d = max - min
      let h
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
      return Math.round(h * 360)
    }
    // 170-290 is the cool band. `ink` is a green (hue ~93) on purpose.
    for (const name of ['terra', 'plum', 'saffron', 'peach', 'sage', 'brick', 'cream']) {
      const h = hue(c[name])
      expect(h > 170 && h < 290, `${name} (hue ${h}) is a cool hue`).toBe(false)
    }
  })

  it('every real text/fill pairing clears WCAG AA', () => {
    // Two pairings used to fail outright: cream on coral was 2.58 and mint was
    // 1.39 against cream. Contrast is easy to break by eye and invisible until
    // someone can't read a button, so it's asserted.
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    // ink reads on the light fills; cream reads on the dark ones. NOTE these are
    // full-strength pairings — a Tailwind opacity suffix (text-ink/70) composites
    // toward the fill and can drop a passing pair under AA. ink/70 on saffron is
    // 2.97, which shipped briefly on the Home stat pills.
    for (const fill of ['cream', 'card', 'peach', 'sage', 'saffron']) {
      expect(ratio(c.ink, c[fill]), `ink on ${fill}`).toBeGreaterThanOrEqual(4.5)
    }
    for (const fill of ['terra', 'plum', 'brick']) {
      expect(ratio(c.cream, c[fill]), `cream on ${fill}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
