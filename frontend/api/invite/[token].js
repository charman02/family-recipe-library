// Vercel serverless function: serves link-preview HTML for /invite/:token.
//
// Only CRAWLER user-agents reach this — frontend/vercel.json routes /invite/:token
// here solely when the request carries a known bot UA (facebookexternalhit,
// WhatsApp, Slackbot, Twitterbot, etc.). A human's browser is never routed here; it
// falls through to the SPA (the /(.*) → /index.html rewrite), so the reading
// experience is completely unchanged and this function can't break it.
//
// It fetches the public InvitePreview (GET /recipes/invite/{token}) and injects the
// recipe's own OG tags so the link unfurls as the actual dish — name, who passed
// it, its cover photo — instead of the one generic app card. See lib/inviteOg.js
// for the (unit-tested) string building.

import { buildInviteMeta, renderInviteOgDocument } from '../../src/lib/inviteOg.js'

// The backend base URL. Reused from the same env var the SPA uses; falls back to
// prod so a missing var degrades to a working card rather than a broken one.
const API_BASE =
  process.env.VITE_API_URL || process.env.API_BASE_URL || 'https://api.issei.app'

export default async function handler(req, res) {
  const token = req.query.token
  // The canonical site origin, from the incoming request host (so preview URLs are
  // correct on preview deploys too), defaulting to the production domain.
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'issei.app'
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const siteOrigin = `${proto}://${host}`

  let recipe = null
  let reached = true
  try {
    const r = await fetch(
      `${API_BASE}/recipes/invite/${encodeURIComponent(token)}`,
      // Timeout is load-bearing, not defensive: without it a HANGING upstream
      // blocks until Vercel's platform max-duration kills the function and returns
      // a 5xx — the one thing this function promises a crawler never gets. The
      // AbortError lands in the catch below and degrades to the neutral card.
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(2500) },
    )
    if (r.ok) recipe = await r.json()
    // A 404 (unknown/expired token) or any non-OK leaves recipe null → the
    // builder shows the not-found card. reached stays true: the server answered.
  } catch {
    // API unreachable, timed out, or errored — we could NOT confirm the token is
    // gone, so this is distinct from a 404. reached=false makes the builder show a
    // neutral "open on issei" card rather than falsely calling a live link expired.
    reached = false
  }

  const meta = buildInviteMeta(recipe, { siteOrigin, token, reached })
  const html = renderInviteOgDocument(meta)

  // Cache at the edge: previews are hit repeatedly (every re-share, every unfurl
  // retry) and the recipe changes rarely. A short s-maxage keeps it fresh enough
  // while sparing the API; stale-while-revalidate hides API latency on a miss.
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=86400',
  )
  res.status(200).send(html)
}
