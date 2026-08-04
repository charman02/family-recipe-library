import { useEffect, useRef, useState } from 'react'
import { HeroCardFace, HeroGreeting } from './HeroCard'
import { heroReason } from '../lib/heroReason'

// The Home hero: a SWIPEABLE deck of recipe cards, each with sheets showing beneath
// its bottom edge.
//
// The card shape was chosen from five bottom-edge treatments (peeking crop,
// perforated stub, fading dissolve, under-stack, folded corner) after a torn-paper
// round established that the hero needed to stop being another rounded rectangle in a
// stack of rounded rectangles. The stack won because it's the only one that says
// something NEW: the depth means "there are more of these".
//
// Which is exactly why it became swipeable — the pile was already promising more, so
// only showing one was a broken promise. Swiping is also the honest interaction for a
// stack of cards, and it lets the heading say "2 of 4" truthfully.
//
// Built on CSS scroll-snap rather than a JS carousel: it's a real native swipe with
// momentum and rubber-banding, works with a trackpad and arrow keys for free, needs
// no gesture library, and degrades to a plain horizontal scroller if anything fails.
// The only JS is reading which card is centred so the heading can follow it.

const TILT = '-rotate-[1.2deg]'

function Frame({ children, onOpen, recipe, className = '' }) {
  return (
    <button
      onClick={onOpen}
      aria-label={`Open ${recipe.name}`}
      className={`w-full text-left bg-card border-[2.5px] border-ink rounded-t-[18px] active:translate-y-[2px] transition-transform ${className}`}
    >
      {children}
    </button>
  )
}

/* Sheets peeking above the card's TOP edge, so the depth reads as a pile of
   photographs you're looking down at.

   They started BELOW the bottom edge. Moving them up puts them against the COVER —
   itself a photo or a coloured type field — so a sliver of another sheet there reads
   as another cover behind this one. At the bottom they sat against the card's white
   body, where a peach sliver read as a stray element instead. It also means every
   card's bottom edge is plain white, with nothing peeking out under it.

   COLOUR: cream and line, NOT palette accents. A first pass used peach and saffron,
   which vanished the moment the card behind them happened to have a saffron cover —
   the cover field is picked from the same four-colour list (coverText.coverField), so
   any accent used here WILL collide on some cards. Two neutral tints one step apart
   read as paper at every combination, and they're the only two fills in the palette
   that nothing else competes with. */
function StackedCard({ recipe, onOpen, behind }) {
  return (
    <div className={TILT}>
      {/* pt-4 is the room the sheets peek into. */}
      <div className="relative pt-4">
        {/* Drawn first so the card paints over them; offset UP and rotated opposite
            ways so they read as separate sheets rather than as a drop shadow.
            Rounded at the TOP only — a fully rounded sheet showed two curves meeting
            the card's straight edge, which read as a tab rather than as paper. The
            rotations fan AROUND the card's own -1.2deg rather than both leaning the
            same way; a first pass had them converging into a wedge at the left. */}
        {behind > 1 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-2 top-0 h-9 bg-line border-[2.5px] border-ink rounded-t-[14px] -rotate-[2.6deg]"
          />
        )}
        {behind > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-1 top-1.5 h-9 bg-cream border-[2.5px] border-ink rounded-t-[14px] rotate-[1.5deg]"
          />
        )}
        <Frame
          recipe={recipe}
          onOpen={onOpen}
          className="relative rounded-b-[18px] shadow-[0_4px_0_rgba(46,58,36,0.14)] pb-5"
        >
          <HeroCardFace recipe={recipe} />
        </Frame>
      </div>
    </div>
  )
}

export function HeroStack({ recipes, shared = [], onOpen, count = 1 }) {
  const [active, setActive] = useState(0)
  const trackRef = useRef(null)

  // Which card is centred. Read from scrollLeft on scroll rather than tracked
  // through touch events, so a trackpad, a keyboard and a flung swipe all agree.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setActive(Math.max(0, Math.min(i, recipes.length - 1)))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [recipes.length])

  const current = recipes[active] || recipes[0]
  // The heading follows the card under your thumb — it names why THAT recipe is
  // here, so a stale heading over a swiped-to card would be a false statement.
  const label = heroReason(current, { shared })
  const behind = Math.min(Math.max(count - 1, 0), 2)

  const go = (i) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div>
      <HeroGreeting count={recipes.length} position={active + 1}>
        {label}
      </HeroGreeting>

      {/* -mx-4/px-4 lets the track bleed to the screen edges while each card stays
          inset — so a card being swiped in is visible at the margin instead of
          appearing out of nowhere. */}
      {/* py-4 is NOT spacing — it's clearance. overflow-x-auto clips on BOTH axes, so
          anything the rotations lift past the track's edges is shaved off.
          Budget, measured rather than guessed: the card's own -1.2deg tilt lifts a
          corner ~4.5px, and the topmost SHEET adds its own -2.6deg over a 382px width,
          which lifts ~8.7px more. py-2 (8px) covered the card alone — correct when the
          sheets sat below it — but once they moved to the top edge it clipped the
          highest sheet by 4.6px, measured in the browser. 16px covers both with room
          to spare; the extra is invisible because the track's siblings set their own
          margins.

          items-start, not the default stretch: a flex track sizes every child to the
          tallest, so a card with no photo left a screen-deep gap under the short card
          and above the dots. Each card now takes its own height. */}
      <div
        ref={trackRef}
        className="flex items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 py-4 gap-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {recipes.map((r) => (
          <div key={r.id} className="snap-center shrink-0 w-full">
            <StackedCard recipe={r} behind={behind} onOpen={() => onOpen(r)} />
          </div>
        ))}
      </div>

      {/* Dots: the affordance that says the deck is swipeable at all. Tappable too,
          because a dot that only reports position is a wasted target. */}
      {recipes.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1 mb-2">
          {recipes.map((r, i) => (
            <button
              key={r.id}
              onClick={() => go(i)}
              aria-label={`Show ${r.name}`}
              aria-current={i === active}
              className={`h-2 rounded-full border-2 border-ink transition-all ${
                i === active ? 'w-5 bg-terra' : 'w-2 bg-cream'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
