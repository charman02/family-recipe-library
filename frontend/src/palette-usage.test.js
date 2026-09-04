import { describe, it, expect } from 'vitest'
import config from '../tailwind.config.js'

// Every source file as raw text, resolved by Vite relative to THIS file — no cwd
// assumptions and no fs/glob API differences between Node versions.
const sources = import.meta.glob('./**/*.{js,jsx}', { query: '?raw', import: 'default', eager: true })

// Tokens that are OURS to judge: every palette key that exists now, PLUS the ones
// `tailwind.config.js` records as deleted. Including the dead ones is the whole point — an
// unknown colour must be caught, not waved through as "probably a Tailwind utility".
const OURS = new Set([
  // live
  'cream', 'card', 'line', 'ink', 'ink-soft', 'terra', 'plum', 'saffron', 'peach', 'sage',
  'brick', 'action',
  // deleted — referencing any of these is the bug this test exists for
  'periwinkle', 'mint', 'coral', 'paper', 'herb', 'growth', 'growth-bright', 'soil',
])

const PREFIXES =
  'bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|divide|placeholder|caret|accent|shadow'

describe('the palette the code uses is the palette that exists', () => {
  it('references no colour the config does not define', () => {
    // This failure is SILENT by construction: Tailwind emits nothing for an unknown colour,
    // so the element renders with no fill — no error, no console warning, nothing to notice
    // except that it looks slightly wrong. It has shipped three times now:
    //   - `bg-paper` after the garden palette was deleted (the app background went white),
    //   - `bg-periwinkle` on a page title, so its highlighter swipe was invisible,
    //   - `bg-mint` on an empty-state badge, so the circle had no fill.
    // In every case the config itself documented the colour as deleted; the code referenced
    // it anyway, the build passed, and every other test passed.
    const defined = new Set(Object.keys(config.theme.extend.colors))
    const offenders = []
    const pattern = new RegExp(
      String.raw`\b(?:` + PREFIXES + String.raw`)-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\/\d+)?\b`,
      'g',
    )
    for (const [file, src] of Object.entries(sources)) {
      if (file.endsWith('.test.js') || file.endsWith('.test.jsx')) continue
      for (const m of src.matchAll(pattern)) {
        const token = m[1]
        if (!OURS.has(token)) continue // Tailwind's own scales/utilities aren't ours to check
        if (!defined.has(token)) offenders.push(`${file} → ${m[0]}`)
      }
    }
    expect(
      offenders,
      `these reference a colour the palette does not define (Tailwind emits nothing, so it renders as no fill):\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('catches a deleted colour when one is used', () => {
    // Proves the check has teeth rather than passing because the regex matches nothing.
    const defined = new Set(Object.keys(config.theme.extend.colors))
    expect(defined.has('periwinkle')).toBe(false)
    expect(defined.has('mint')).toBe(false)
    expect(OURS.has('periwinkle')).toBe(true) // ...and we still watch for it
  })
})
