import { describe, it, expect } from 'vitest'
import { escapeHtml, buildInviteMeta, renderInviteOgDocument } from './inviteOg'

const CTX = { siteOrigin: 'https://issei.app', token: 'tok123' }

describe('escapeHtml', () => {
  it('escapes the characters that would break HTML or an attribute', () => {
    expect(escapeHtml(`<b>"Mom's" & <adobo></b>`)).toBe(
      '&lt;b&gt;&quot;Mom&#39;s&quot; &amp; &lt;adobo&gt;&lt;/b&gt;',
    )
  })
  it('renders null/undefined as empty, not the words "null"/"undefined"', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('buildInviteMeta — a real recipe', () => {
  const recipe = {
    name: 'Adobo',
    from_name: 'Charlie',
    origin_attribution: 'Lola',
    description: 'A braise that tastes like her kitchen.',
    cover_photo_url: 'https://img.test/adobo.jpg',
  }

  it('titles with the dish and its byline', () => {
    const m = buildInviteMeta(recipe, CTX)
    expect(m.title).toBe('Adobo — from Lola')
    expect(m.found).toBe(true)
  })

  it('names the sender in the description', () => {
    const m = buildInviteMeta(recipe, CTX)
    expect(m.description).toContain('Charlie passed you the recipe for Adobo')
  })

  it('uses the cover photo as the preview image', () => {
    expect(buildInviteMeta(recipe, CTX).image).toBe('https://img.test/adobo.jpg')
  })

  it('builds the canonical invite url from origin + token', () => {
    expect(buildInviteMeta(recipe, CTX).url).toBe('https://issei.app/invite/tok123')
  })

  it('falls back to the site og image when the recipe has no cover', () => {
    const m = buildInviteMeta({ ...recipe, cover_photo_url: null }, CTX)
    expect(m.image).toBe('https://issei.app/og.png')
  })

  it('drops the byline from the title when the recipe has no attribution', () => {
    const m = buildInviteMeta({ ...recipe, origin_attribution: null }, CTX)
    expect(m.title).toBe('Adobo')
  })

  it('handles a missing sender without leaving a blank', () => {
    const m = buildInviteMeta({ ...recipe, from_name: null }, CTX)
    expect(m.description).toContain('Someone passed you the recipe for Adobo')
  })
})

describe('buildInviteMeta — unknown or expired token', () => {
  it('returns a generic, honest card and never throws', () => {
    const m = buildInviteMeta(null, CTX)
    expect(m.found).toBe(false)
    expect(m.title).toBe('A recipe on issei')
    expect(m.image).toBe('https://issei.app/og.png')
    expect(m.url).toBe('https://issei.app/invite/tok123')
  })

  it('treats a payload with no name as not-found', () => {
    expect(buildInviteMeta({ from_name: 'Charlie' }, CTX).found).toBe(false)
  })

  it('says "expired" only when the server actually answered (reached=true)', () => {
    // A confirmed 404 → the token really is gone, so the honest word is "expired".
    const m = buildInviteMeta(null, { ...CTX, reached: true })
    expect(m.description).toMatch(/expired or moved/i)
  })

  it('does NOT call a link expired when the API was unreachable (reached=false)', () => {
    // The API was down/slow/errored — the link may be perfectly valid. Calling it
    // "expired" here would be a lie, and could get edge-cached. Neutral copy instead.
    const m = buildInviteMeta(null, { ...CTX, reached: false })
    expect(m.description).not.toMatch(/expired/i)
    expect(m.description).toMatch(/open this recipe on issei/i)
    expect(m.found).toBe(false)
  })
})

describe('renderInviteOgDocument', () => {
  it('injects the recipe-specific OG tags a crawler reads', () => {
    const html = renderInviteOgDocument(buildInviteMeta(
      { name: 'Adobo', from_name: 'Charlie', origin_attribution: 'Lola', cover_photo_url: 'https://img.test/a.jpg' },
      CTX,
    ))
    expect(html).toContain('<meta property="og:title" content="Adobo — from Lola" />')
    expect(html).toContain('<meta property="og:image" content="https://img.test/a.jpg" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    // Bounces a human who somehow lands here back to the real URL.
    expect(html).toContain('url=https://issei.app/invite/tok123')
  })

  it('escapes a hostile recipe name so it cannot break out of the tag', () => {
    const html = renderInviteOgDocument(buildInviteMeta(
      { name: '"><script>alert(1)</script>', from_name: 'X' },
      CTX,
    ))
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('claims no audio anywhere in the document (POSITIONING)', () => {
    const banned = /record|recording|\bvoice\b|audio|listen/i
    const cases = [
      buildInviteMeta({ name: 'Adobo', from_name: 'Charlie', origin_attribution: 'Lola' }, CTX),
      buildInviteMeta(null, CTX),
    ]
    for (const meta of cases) {
      expect(renderInviteOgDocument(meta)).not.toMatch(banned)
    }
  })
})
