// Generates frontend/public/og.png — the static Open Graph / social-share card.
//
// Zero new dependencies: uses `playwright` (already a devDependency) and its
// installed Chromium to render brand-accurate HTML at exactly 1200x630 and
// screenshot it to PNG. Fonts (Fraunces + Nunito Sans) are pulled from Google
// Fonts and we wait on document.fonts.ready so the raster matches the app.
//
// Run:  node scripts/generate-og.mjs   (from the frontend/ directory)
//
// The card mirrors public/og.svg (the source of truth for the design):
// cream field, "issei." wordmark in Fraunces black with a terra period, a terra
// underline, and the positioning one-liner in Nunito Sans ink.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../public/og.png')

const WIDTH = 1200
const HEIGHT = 630
const CREAM = '#FBF3E2'
const INK = '#2E3A24'
const TERRA = '#B5502A'

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Nunito+Sans:opsz,wght@6..12,700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
      body {
        background: ${CREAM};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Nunito Sans', system-ui, sans-serif;
      }
      .mark {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 900;
        font-size: 210px;
        letter-spacing: -0.05em;
        line-height: 1;
        color: ${INK};
      }
      .mark .dot { color: ${TERRA}; }
      .rule {
        width: 88px;
        height: 8px;
        border-radius: 4px;
        background: ${TERRA};
        margin: 28px 0 40px;
      }
      .tagline {
        color: ${INK};
        font-weight: 700;
        font-size: 38px;
        line-height: 1.35;
        text-align: center;
        max-width: 900px;
      }
    </style>
  </head>
  <body>
    <div class="mark">issei<span class="dot">.</span></div>
    <div class="rule"></div>
    <div class="tagline">Someone cooked you something you'd never had.<br/>This is how they send you the recipe.</div>
  </body>
</html>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } })
  console.log('Wrote', OUT)
} finally {
  await browser.close()
}
