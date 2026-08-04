// What fills a recipe's frame when there is no photo.
//
// The old fallback was the `issei.` wordmark plus "A photo brings this dish to
// life" — which renders an ABSENCE: it names the missing thing, scolds the owner
// for not having done it, and means nothing at all to a recipient who has no
// upload button. On a grid it read as a row of incomplete database rows.
//
// Recipe managers (Paprika, AnyList, Copy Me That) all show a muted plate glyph,
// which is the same absence with better manners. Editorial apps (NYT Cooking) dodge
// it by shooting every dish. UGC sites (Allrecipes) crowdsource it, which needs many
// people cooking one dish — the wrong shape for an app that hands one recipe to one
// person. And auto-matching a stock photo is the worst of all: the dish shown isn't
// theirs, which is both a lie about the recipe and a kind of consent violation.
//
// The apps that solve this well aren't recipe apps at all — Substack, Ghost and
// Penguin covers set the TITLE as the art, and Slack/Gmail use a colored monogram.
// What they share is that they render a different kind of PRESENCE rather than a
// hole. That's a better fit here than anywhere: this app's whole claim is that the
// words are the content, so type in the frame is closer to the thesis than a photo.

import { isImprecise } from './measures'

// Field colors, keyed off the recipe id so a given dish always looks the same and
// two cards side by side rarely match. All four are AA-safe under ink (peach 9.35,
// sage 6.42, saffron 4.93, line 8.58).
const FIELDS = ['bg-peach', 'bg-sage', 'bg-saffron', 'bg-line']

export function coverField(recipe) {
  const seed = Number(recipe?.id) || 0
  return FIELDS[Math.abs(seed) % FIELDS.length]
}

// The most quotable line in THIS recipe, or null.
//
// Deliberately skips precise amounts — "200 g" in big italic type would look like
// the app misunderstanding its own feature.
//
// `avoid` names text already on screen elsewhere, and it exists because of a real
// defect: on the recipe page the cover quoted a step remark that then appeared
// verbatim in the Steps list a few hundred pixels below — the same sentence twice on
// one screen, which reads as a rendering bug rather than as emphasis. The recipe page
// passes 'notes' so its cover reaches for an AMOUNT instead; an amount lives in a
// table there, so a pull quote of it doesn't read as duplication. Cards pass nothing:
// a card shows neither steps nor amounts, so anything is fresh.
export function coverLine(recipe, { avoid = null } = {}) {
  if (!recipe) return null

  // A remark is a whole thought ("Don't crowd the pan"), while an amount needs its
  // ingredient name to make sense — so remarks come first where they're allowed.
  if (avoid !== 'notes') {
    for (const s of recipe.steps || []) {
      const note = (s.voice_note || '').trim()
      // Long remarks don't set well at display size and would need clamping, which
      // reads as truncated content rather than as a pull quote.
      if (note && note.length <= 60) return { text: note, kind: 'note' }
    }
  }

  const ings = [
    ...(recipe.ingredients || []),
    ...(recipe.ingredient_sections || []).flatMap((s) => s.ingredients || []),
  ]
  for (const i of ings) {
    if (i.quantity_text && isImprecise(i)) {
      const text = i.name ? `${i.quantity_text} of ${i.name}` : i.quantity_text
      if (text.length <= 60) return { text, kind: 'amount' }
    }
  }
  return null
}
