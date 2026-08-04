import CoverImage from './CoverImage'

// The Home hero's card FACE, plus the heading that sits above it.
//
// Kept separate from HeroStack (the bottom-edge treatment) because the two were
// chosen in separate rounds and answer separate questions: the face decides WHAT
// the hero shows, the stack decides what shape it is. It shows the recipe the way
// the recipe page does — photo edge-to-edge, the person in plum, the dish name
// large, outlined tags, description clamped to two lines — so the hero looks like a
// smaller version of where tapping it takes you.
//
// `edge` picks the treatment; see HeroEdges.jsx for what each one argues.

export function HeroCardFace({ recipe, showCta = true }) {
  const source = (recipe.origin_attribution || '').split('·')[0].trim()
  const byline = source || recipe.author_full_name
  const tags = [recipe.cuisine, recipe.diet].filter(Boolean)

  return (
    <>
      {/* Rounded only at the top: every treatment does something else at the
          bottom, so squaring it there is the shared starting point. */}
      {/* rounded-t + overflow-hidden must be on the SAME element as the image, or the
          cover paints square corners over the card's rounded ones — visible as two
          hard 90° angles at the top of every hero card with a photo. */}
      <span className="block rounded-t-[15.5px] overflow-hidden">
        {/* CoverImage, not a bare <img>: a hero card with no photo used to render NO
            frame at all, which made it far shorter than a card with one. In a swipe
            deck that's not just inconsistent — a flex track is as tall as its tallest
            card, so the short one left a screen-deep gap above the dots. Every card
            now has a 150px frame, filled with the recipe's own words when there's no
            photo (see lib/coverText.js). */}
        <CoverImage
          url={recipe.cover_photo_url}
          size="md"
          recipe={recipe}
          hero
          className="w-full h-[150px] object-cover block border-b-[2.5px] border-ink"
        />

        <span className="block px-5 pt-4">
          {byline && (
            <span className="block text-[13px] leading-none">
              <span className="font-sans text-ink-soft/80">from </span>
              <span className="font-display font-bold italic text-plum">
                {byline}
              </span>
            </span>
          )}
          <span className="block font-display font-black text-[30px] leading-[1.04] text-ink mt-1.5 text-balance">
            {recipe.name}
          </span>

          {(tags.length > 0 || recipe.servings) && (
            <span className="flex flex-wrap items-center gap-1.5 mt-3">
              {/* Cuisine and diet stay CREAM; servings is tinted. They aren't the
                  same kind of fact — cuisine and diet DESCRIBE the dish, servings is a
                  QUANTITY, and it's the number a cook checks before committing to
                  make something. Tinting it lifts the number out of two label-shaped
                  pills instead of leaving three identical outlines to read through.
                  Cuisine stays cream so it still matches the cuisine tag on every grid
                  card — one fact looking like one category across screens was the
                  point of the original fix (it used to be peach here, saffron there).
                  Compared against tinting cuisine instead, and against tinting both. */}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="font-display font-bold text-[10.5px] uppercase tracking-[0.08em] text-ink bg-cream border-2 border-ink rounded-full px-2.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
              {recipe.servings && (
                <span className="font-display font-bold text-[10.5px] uppercase tracking-[0.08em] text-ink bg-peach border-2 border-ink rounded-full px-2.5 py-0.5">
                  Serves {recipe.servings}
                </span>
              )}
            </span>
          )}

          {recipe.description && (
            <span className="block font-display text-[14.5px] leading-snug text-ink mt-3 line-clamp-2">
              {recipe.description}
            </span>
          )}

          {showCta && (
            <span className="block font-display font-bold text-[13.5px] text-terra mt-4">
              Cook it &rarr;
            </span>
          )}
        </span>
      </span>
    </>
  )
}

// The heading that says WHY this recipe is in the hero (see lib/heroReason.js).
// It sits OUTSIDE the card and is never rotated: the tilt belongs to the object, and
// rotating a line the reader has to parse costs legibility for nothing.
//
// CHOSEN from four treatments compared side by side. What they all shared — and the
// actual finding — is that the hero heading gets NO marker swipe: every section title
// on the page has one, so a swipe here made the biggest thing on screen read as just
// another section, and at the original 22px it lost outright to the dish name 40px
// below it. This is the version that also answers "why is THIS recipe huge?", by
// pairing the reason with the count it was drawn from. The other three (short rule,
// left-bar stack, full hairline) are deleted rather than left behind a flag.

// The rule colour carries the reason, so one glance says which KIND of recipe this is
// before the words are read. terra is the app's action colour; plum is the person
// colour, used where a person put the dish in your hands.
const REASON_ACCENT = {
  'Waiting for you': 'bg-plum',
  'Cook it again': 'bg-terra',
  'Freshly kept': 'bg-terra',
  'From your kitchen': 'bg-terra',
}

export function HeroGreeting({ children, count = null, position = 1 }) {
  const label = children
  const accent = REASON_ACCENT[label] || 'bg-terra'

  return (
    <div className="mb-3.5 px-0.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display font-black text-[30px] leading-none text-ink">
          {label}
        </h2>
        {/* "N of M" is omitted at one recipe: "1 of 1" is a worse thing to read
            than no number at all. */}
        {count > 1 && (
          <span className="font-display text-[12px] text-ink-soft leading-none pb-1 flex-none">
            {position} <span className="italic">of</span> {count}
          </span>
        )}
      </div>
      <span className={`block h-[3px] rounded-full mt-2.5 w-16 ${accent}`} />
    </div>
  )
}
