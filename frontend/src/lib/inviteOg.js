// Pure builders for the invite link-preview (Open Graph) card.
//
// WHY THIS EXISTS: a link to /invite/{token} should unfurl in iMessage / WhatsApp /
// Slack showing the ACTUAL recipe — its name, who passed it, its photo — not the
// one generic app card every link used to share. Link crawlers do NOT run the
// SPA's JavaScript, so those meta tags have to be in the raw HTML the server
// returns. The Vercel function at `api/invite/[token].js` serves crawlers this
// document; humans are left on the normal SPA (see frontend/vercel.json — only
// crawler user-agents are routed to the function). This module holds the
// string-building so it is unit-testable without Vercel.
//
// POSITIONING: the copy only ever describes passing a recipe to a person. No
// "voice", "recording", "audio", "listen" — there is none here, and the ban is
// app-wide (POSITIONING.md); a test asserts this document never reintroduces it.

const FALLBACK_IMAGE_PATH = '/og.png'

// Escape for use in both element text and double-quoted attributes. Recipe names
// are user input ("Mom's ""special"" adobo", a stray <), so this is correctness
// (don't break the HTML) as much as safety.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Given the InvitePreview payload (or null) and the request context, produce the
// fields a crawler card needs. `from_name` is who passed the link on (the owner —
// only an owner can hand off); `origin_attribution` is the dish's own byline
// ("Lola"), which is who the recipe is *from*.
//
// `reached` distinguishes two null-recipe cases the copy must NOT conflate:
//   · reached=true, no recipe → the server answered 404: the token is genuinely
//     unknown/expired, so say so.
//   · reached=false → we couldn't reach/parse the API (down, timeout, blip): the
//     link may be perfectly valid, so a neutral "open on issei" card is honest
//     where "this link expired" would be a lie (and could get edge-cached).
export function buildInviteMeta(recipe, { siteOrigin, token, reached = true }) {
  const url = `${siteOrigin}/invite/${token}`
  if (!recipe || !recipe.name) {
    const description = reached
      ? 'This recipe link has expired or moved. issei is how someone sends you a dish they cook.'
      : 'Open this recipe on issei — how someone sends you a dish they cook.'
    return {
      url,
      title: 'A recipe on issei',
      description,
      image: `${siteOrigin}${FALLBACK_IMAGE_PATH}`,
      imageAlt: 'issei',
      found: false,
    }
  }
  const name = recipe.name
  const byline = (recipe.origin_attribution || '').trim() || null
  const sender = (recipe.from_name || '').trim() || null
  // Title carries the dish and its byline — the app's "from {person}" convention.
  const title = byline ? `${name} — from ${byline}` : name
  // Description names the SENDER ("Charlie passed you…"), mirroring the landing.
  const who = sender ? `${sender} passed you` : 'Someone passed you'
  const description = recipe.description
    ? `${who} the recipe for ${name} on issei. ${recipe.description}`
    : `${who} the recipe for ${name} on issei — read it and cook it, no account needed.`
  const image = recipe.cover_photo_url || `${siteOrigin}${FALLBACK_IMAGE_PATH}`
  const imageAlt = byline ? `${name}, from ${byline}` : name
  return { url, title, description, image, imageAlt, found: true }
}

// Render the crawler HTML document. A human who somehow lands here (they shouldn't —
// the rewrite only routes crawler user-agents) is bounced to the real URL by the
// meta refresh; on that second request their human UA falls through to the SPA, so
// there is no redirect loop.
export function renderInviteOgDocument(meta) {
  const t = escapeHtml(meta.title)
  const d = escapeHtml(meta.description)
  const u = escapeHtml(meta.url)
  const img = escapeHtml(meta.image)
  const alt = escapeHtml(meta.imageAlt)
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="issei" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <meta http-equiv="refresh" content="0; url=${u}" />
  </head>
  <body>
    <p>Opening ${t} on issei&hellip; <a href="${u}">Tap here if it doesn&rsquo;t open.</a></p>
  </body>
</html>`
}
