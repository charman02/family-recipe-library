import Wordmark from './Wordmark'
import { coverField } from '../lib/coverText'

// Renders a recipe cover photo — or, with no photo, the issei mark on a colour field.
//
// THIS IS THE THIRD ANSWER to "what fills an empty frame", and the history matters
// because each version was a reaction to a real problem with the one before it:
//
//   1. The `issei.` wordmark plus "A photo brings this dish to life". Replaced because
//      that copy renders an ABSENCE: it names the missing thing, scolds an owner for not
//      having done it, and means nothing at all to a recipient with no upload button.
//   2. A pull quote from the recipe's own words — a folk amount or a step remark, set
//      large. Reasonable on paper (this app's claim is that the words ARE the content)
//      and it survived a three-way comparison. It failed on contact with a real user.
//   3. This: the mark alone, no copy.
//
// WHY (2) FAILED. The developer's mother, looking at a recipe page, asked "why are there
// ingredients on the cover photo?" — and she was reading it correctly. The frame is
// photo-shaped, photo-sized and photo-positioned, so 26px italic type inside it has no
// cue that it is a pull quote rather than a label printed over an image. Worse, the
// recipe page passed avoid="notes", which made it skip step remarks and reach for an
// imprecise AMOUNT specifically — so every recipe with a folk amount got an ingredient
// line on its cover, on the one screen where the ingredient table is also visible.
//
// WHY THIS ISN'T A RETURN TO (1). Only half of what replaced the wordmark was
// load-bearing. "A photo brings this dish to life" was the scolding part and it stays
// gone; the mark itself was never the problem. What ships here is the mark with NO copy
// beneath it — no nudge, no plate glyph, nothing naming what's missing.
//
// The per-recipe tint survives from (2): coverField picks from four colours keyed off
// the recipe id, so a grid of photo-less recipes still varies instead of reading as one
// repeated tile, and a given dish keeps its colour everywhere it appears.

// How big the mark is in each frame. Scaled rather than swapped, so it's recognisably
// the same object at every size — a different treatment per size would read as several
// different placeholders.
const MARK_SCALE = {
  sm: 'scale-[0.62]', // grid card thumbnails
  md: 'scale-[0.92]', // recipe cards
  lg: 'scale-[1.15]', // the recipe page's own hero
}

export default function CoverImage({
  url,
  size = 'md',
  // Kept in the signature because callers pass it and it still means something for
  // future treatments, but the mark is now identical for owner and reader. The old
  // reader branch existed to avoid stamping a second brand mark under the invite page's
  // header — see the note in InviteLanding about why that surface is the one to watch.
  context = 'owner',
  recipe = null,
  // Retained for call-site compatibility; the cover no longer reads recipe text at all,
  // so nothing can collide with what a page prints elsewhere. See git history for the
  // pull-quote version this replaced.
  avoid = null,
  hero = false,
  className = '',
}) {
  if (url) {
    return <img src={url} alt="" className={`object-cover ${className}`} />
  }

  const field = coverField(recipe)
  const scale = hero ? MARK_SCALE.lg : MARK_SCALE[size] || MARK_SCALE.md

  return (
    <div
      className={`${field} flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {/* BARE, not the plated header mark. Both were rendered side by side on a real
          recipe: the plate puts a rounded outlined box inside a rounded outlined box,
          and the frame already supplies the shape, the outline and the colour. */}
      <Wordmark size="sm" bare className={scale} />
    </div>
  )
}
