import { coverLine, coverField } from '../lib/coverText'
import { sourceNameOf } from '../lib/sourceName'

// Renders a recipe cover photo — or, when there's no photo, fills the frame with
// TYPE rather than announcing an absence. See lib/coverText.js for the full
// reasoning and what other apps do here; the short version is that a plate glyph or
// an "add a photo" nudge renders a hole, and this app's claim is that the words are
// the content, so type in the frame is closer to the thesis than a stock photo.
//
// CHOSEN from three treatments compared side by side on real data: a quote from the
// recipe's own words, the dish name as art, and this — a HYBRID using the quote when
// the recipe has one and the title when it doesn't. Each pure version had one flaw
// the hybrid avoids: the title alone repeats the dish name already printed directly
// beneath the frame on every card, and the quote alone never says what the dish IS.
// Mixing them also makes a grid visually varied rather than uniformly redundant.
// The rejected two are deleted, not kept behind a flag.

const sizes = {
  // pt is larger than pb on the card sizes: the cuisine pill is absolutely
  // positioned in the frame's top-left corner, so text starting at the top ran
  // underneath it.
  sm: { mono: 'text-[34px]', by: 'text-[9px]', pad: 'px-2.5 pt-8 pb-2', quote: 'text-[14px]' },
  md: { mono: 'text-[52px]', by: 'text-[11px]', pad: 'px-4 pt-11 pb-3.5', quote: 'text-[19px]' },
  lg: { mono: 'text-[68px]', by: 'text-[13px]', pad: 'px-6 pt-6 pb-5', quote: 'text-[26px]' },
}

// The last resort: no photo AND nothing quotable in the recipe.
//
// It draws the dish's INITIAL, not its name. Setting the full name here was the
// obvious move and it's what the rejected title-only variant did — but every card
// prints the dish name directly beneath the frame, so it was the same words twice
// ~20px apart. A monogram is the pattern Slack, Gmail and Contacts all use, it reads
// instantly as "no image and that's fine", and it repeats nothing.
//
// The last resort: no photo AND nothing quotable in the recipe.
//
// It draws the dish's INITIAL, not its name — every surface that shows a cover also
// prints the dish name within ~20px of it, so the full name here was the same words
// twice (three page tests caught that immediately when it was tried at lg). A
// monogram is the pattern Slack, Gmail and Contacts use: instantly read as "no image
// and that's fine", and it repeats nothing.
//
// `word` adds the name SMALL beneath the letter, for the one frame big enough that a
// lone letter floats — the Home hero at 150px. It's a different treatment from the
// card's own title below it (uppercase, tracked, small), so the pair reads as a
// designed cover rather than as an accidental echo.
function TitleCover({ recipe, s, field, className, word = false }) {
  const name = (recipe?.name || '').trim()
  return (
    <div
      className={`${field} flex flex-col items-center justify-center text-center ${s.pad} ${className}`}
      aria-hidden="true"
    >
      <span className={`font-display font-black leading-none text-ink ${s.mono}`}>
        {name.charAt(0).toUpperCase()}
      </span>
      {word && (
        <span className="font-display font-bold uppercase tracking-[0.16em] text-[10px] text-ink/85 mt-2">
          {name}
        </span>
      )}
    </div>
  )
}

export default function CoverImage({
  url,
  size = 'md',
  context = 'owner',
  recipe = null,
  // Text already visible elsewhere on the calling screen — see coverText.coverLine.
  avoid = null,
  // The Home hero card: a 150px frame where a lone monogram floats.
  hero = false,
  className = '',
}) {
  if (url) {
    return <img src={url} alt="" className={`object-cover ${className}`} />
  }

  // The hero frame has no cuisine pill in its corner, so it doesn't need the
  // asymmetric top padding the grid cards use to clear one — and with it, a short
  // quote sat visibly below centre in a 150px box.
  const s = hero
    ? { ...(sizes.md), pad: 'px-5 py-4', quote: 'text-[21px]' }
    : sizes[size] || sizes.md
  const field = coverField(recipe)

  // No recipe passed — keep a plain colour field rather than throwing.
  if (!recipe) {
    return <div className={`${field} ${className}`} aria-hidden="true" />
  }

  const line = coverLine(recipe, { avoid })
  if (!line) {
    return (
      <TitleCover
        recipe={recipe}
        s={s}
        field={field}
        className={className}
        word={hero}
      />
    )
  }

  // The quote carries NO attribution on an owner surface: a first pass put the
  // person's name inside the frame, and since a card prints "from Tita Baby" 40px
  // below, that was the same name twice — the identical mistake the title-only
  // version makes with the dish name. `reader` surfaces (the invite landing) do get
  // it, because there the frame is the first thing on the page and nothing above has
  // named anyone yet.
  const person = context === 'reader' ? sourceNameOf(recipe) : null

  return (
    <div
      className={`${field} flex flex-col justify-center ${s.pad} ${className}`}
      aria-hidden="true"
    >
      <span
        className={`font-display font-bold italic leading-[1.2] text-ink text-balance ${s.quote}`}
      >
        &ldquo;{line.text}&rdquo;
      </span>
      {person && (
        <span
          className={`font-display font-bold uppercase tracking-[0.1em] text-ink/85 mt-2.5 ${s.by}`}
        >
          {person}
        </span>
      )}
    </div>
  )
}
