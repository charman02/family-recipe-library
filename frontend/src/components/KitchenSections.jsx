import Icon from './Icon'
import {
  peopleInKitchen,
  personOf,
  quotableLines,
  lineOfTheDay,
  unfinished,
  kitchenGlance,
  shortName,
} from '../lib/kitchenFacts'

// The Home page's "explore" sections.
//
// The page was a hero plus grids of recipe cards — accurate, but one shape repeated,
// with nothing to look at twice. What makes most apps explorable is a feed of other
// people's content, and that is exactly what this product disclaims, so the interest
// has to come OUT of the thesis rather than be borrowed from elsewhere.
//
// Which turns out to be easy, because the app is sitting on material no competitor
// has: the people a kitchen came from, and amounts nobody rounded off. All of it is
// already fetched and currently three taps deep.

/* WHOSE RECIPES LIVE HERE — the most this-app-only section on the page. issei models
   the person a dish came from, so it can group by them; a recipe box can't, and
   neither can a competitor whose recipes have an "author" field and nothing more.
   Initial discs for now — real faces once task #33 lands. */
export function PeopleRow({ recipes, onPerson }) {
  const people = peopleInKitchen(recipes)
  if (people.length < 2) return null // one person is a fact, not a collection

  return (
    <section className="home-section">
      {/* "Whose recipes live here" was a question phrased as a label. This is the
          same fact said plainly, in the app's kitchen register ("Your kitchen",
          "Open your kitchen") — and at section-head size, because at 12px tracked
          uppercase it read as a caption beside the swiped headers. */}
      <div className="px-5">
        <h3 className="section-head">The people in your kitchen</h3>
        <span aria-hidden="true" className="section-rule bg-plum" />
      </div>
      <div className="flex gap-3.5 overflow-x-auto scrollbar-hide px-5 pt-3 pb-1">
        {people.map((p) => (
          <button
            key={p.name}
            onClick={() => onPerson?.(p)}
            aria-label={`${p.name} — ${p.count} ${p.count === 1 ? 'recipe' : 'recipes'}`}
            className="flex-none w-[74px] text-center"
          >
            {/* The initial and the caption both come from shortName, so an
                "Auntie Ling" disc reads L / Ling rather than A / Auntie — three
                different aunties would otherwise be indistinguishable. */}
            <span className="mx-auto flex items-center justify-center w-[58px] h-[58px] rounded-full bg-plum text-cream font-display font-black text-[22px] border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24]">
              {shortName(p.name).charAt(0).toUpperCase()}
            </span>
            <span className="block font-display font-bold text-[12.5px] text-ink mt-1.5 truncate">
              {shortName(p.name)}
            </span>
            <span className="block font-display text-[11px] text-ink-soft">
              {p.count}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/* THEIR WORDS — one real line from the kitchen: an amount nobody converted, or a
   remark someone left on a step. This is the product's argument in miniature, and
   it's the app's most charming text, so it is now sized and coloured like it.

   It WAS a small quote in a 25%-tint box, which was the timidest thing on a page of
   saturated stickers — the one section that proves the whole thesis was whispering.
   Now: a full peach sticker, the line at 21px, and a big saffron quote stamp. peach
   rather than saffron because peach is already the "someone's story" colour (the
   story callout, the first-run hero) and this is the same kind of content.

   The line is CENTRED and the attribution sits under a short rule, because a quote
   with a name beneath it is a form everyone can already read. */
export function TheirWordsCard({ recipes, onOpen }) {
  const line = lineOfTheDay(quotableLines(recipes))
  if (!line) return null

  return (
    <section id="their-words" className="px-5 home-section scroll-mt-6">
      <h3 className="section-label">Their words</h3>
      <button
        onClick={() => onOpen?.(line.recipe)}
        className="relative w-full text-left sticker sticker-press bg-peach px-5 pt-8 pb-5 mt-5"
      >
        {/* The quote stamp: a real graphic element, ink-outlined like everything
            else, rather than a grey glyph tucked in a corner.
            NOT inside an overflow-hidden parent — the sticker had it, and it sliced
            the top third of the stamp clean off. The mt-5 above leaves the room the
            stamp needs to hang over the card's edge. */}
        <span
          aria-hidden="true"
          className="absolute -top-4 left-4 flex items-center justify-center w-11 h-11 rounded-full bg-cream border-[2.5px] border-ink shadow-[0_2px_0_#2E3A24] font-display font-black text-[26px] pt-3 text-ink"
        >
          &ldquo;
        </span>

        <span className="block font-display font-bold italic text-[21px] leading-[1.25] text-ink text-balance">
          {line.kind === 'amount' ? `${line.text} of ${line.detail}` : line.text}
        </span>

        <span aria-hidden="true" className="block h-[2px] w-10 bg-ink/25 rounded-full mt-4" />
        <span className="block font-display text-[13px] text-ink-soft mt-2">
          {line.person ? `${line.person} · ` : ''}
          {line.recipe.name}
        </span>
      </button>
    </section>
  )
}

/* FILL THESE IN — the only section that ASKS for something, so it sits below both
   grids and is capped at three. Ordered by what the gap costs a RECIPIENT: a recipe
   with no steps can't be cooked, a missing photo is cosmetic. That ordering is why
   this isn't nagging — a richer recipe makes a better handoff, so it serves the
   product and not just the page.

   It WAS the blandest block on the screen: a cream card, hairline dividers, grey
   italic labels and a thin chevron — a settings list on a page of stickers. The fix
   isn't decoration, it's giving each row the same VOCABULARY as the rest of the app:
   the missing thing is named in an outlined chip (the language used for cuisine tags
   and filters), and each row is its own pressable sticker rather than a divided list,
   because each one goes somewhere different. Rows alternate peach/saffron tints so a
   list of three doesn't read as one grey block.

   Rows are ONE colour, not alternating. A peach/saffron-tint alternation was tried
   and read as an accident: the two are 0.26 apart in luminance, close enough that it
   looked like a rendering inconsistency rather than a rhythm. The gap between rows
   plus each row's own outline and shadow already separate them.

   The chip colour is deliberately NOT a severity scale — red/amber/green would grade
   someone's grandmother's recipe, and the ordering already carries priority. */

export function FinishThese({ recipes, onOpen }) {
  const rows = unfinished(recipes)
  if (!rows.length) return null

  return (
    <section className="px-5 home-section">
      <h3 className="section-head">Fill these in</h3>
      <span aria-hidden="true" className="section-rule bg-terra" />
      <p className="font-display italic text-[13.5px] text-ink-soft mt-2.5">
        A fuller recipe is a better one to hand on.
      </p>
      <div className="flex flex-col gap-2.5 mt-3.5">
        {rows.map(({ recipe, label, icon, tint }) => {
          const person = personOf(recipe)
          return (
            <button
              key={recipe.id}
              onClick={() => onOpen?.(recipe)}
              className="sticker sticker-press bg-card flex items-center gap-3 w-full px-3.5 py-3 text-left"
            >
              {/* The gap's own glyph, on its own tint. Three rows whose only
                  difference was a few words of small type looked like one repeated
                  row — you had to read every chip to find the one you cared about. */}
              <span
                aria-hidden="true"
                className={`flex-none flex items-center justify-center w-10 h-10 rounded-[12px] border-2 border-ink ${tint}`}
              >
                <Icon name={icon} className="w-5 h-5 text-ink" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-display font-black text-[15.5px] leading-tight text-ink truncate">
                  {recipe.name}
                </span>
                {/* Whose dish it is. Without it the list was three bare titles, and
                    the person is the thing that makes filling one in feel worth
                    doing. plum is the person colour everywhere else in the app. */}
                {person && (
                  <span className="block text-[12px] leading-tight mt-0.5 truncate">
                    <span className="font-sans text-ink-soft/80">from </span>
                    <span className="font-display font-bold italic text-plum">
                      {person}
                    </span>
                  </span>
                )}
                {/* "Missing" once, in muted sentence case, then the thing itself in
                    ink — so the eye lands on the DIFFERENCE between rows instead of
                    re-reading a shared prefix in every one. Sentence case, not
                    tracked caps: at 10px, caps made "ADD THE STEPS" and "ADD THE
                    STORY" the same shape. */}
                <span className="inline-flex items-baseline gap-1 font-display text-[11.5px] mt-1">
                  <span className="text-ink-soft/85">Missing</span>
                  <span className="font-bold text-ink">{label}</span>
                </span>
              </span>

              <span className="font-display font-black text-ink text-[15px] leading-none flex-none">
                &rarr;
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* AT A GLANCE — three colour-blocked stat stickers.
   They were three identical cream outlines, which is the same "one shape repeated"
   problem the whole page had, just smaller. Each now carries its own fill drawn from
   the colour it's about — plum for people (plum is the person colour everywhere
   else), saffron for their words (the knowledge accent), peach for the count — so
   the strip is a legend for the page's colour language as well as a stat row.

   The third pill counts the amounts nobody rounded off plus the remarks left on
   steps. It replaced a cooks pill reading cook_count, which is 0 for every real user
   (task #32) — and unlike cooks, this is a number no other recipe app could print,
   because they all converted those amounts to grams on the way in.

   It's labelled "in their words", NOT "their words": the quote card lower down is
   already titled "Their words", and having a stat pill and a section share a name
   made them look like the same feature rendered twice. Tapping it scrolls to that
   card, which is the relationship the wording should imply. */
export function KitchenGlance({ recipes, onWords }) {
  const g = kitchenGlance(recipes)
  const pills = [
    { n: g.recipes, word: g.recipes === 1 ? 'recipe' : 'recipes', fill: 'bg-peach' },
    { n: g.people, word: g.people === 1 ? 'person' : 'people', fill: 'bg-plum', dark: true },
    ...(g.theirWords > 0
      ? [
          {
            n: g.theirWords,
            word: 'in their words',
            fill: 'bg-saffron',
            onClick: onWords,
          },
        ]
      : []),
  ]

  // role=list + a label per pill so a screen reader reads "2 recipes" as one unit
  // rather than announcing a floating "2" and then a floating "recipes".
  return (
    <div
      role="list"
      aria-label="Your kitchen at a glance"
      className="flex gap-2.5 px-5 home-attached"
    >
      {pills.map(({ n, word, fill, dark, onClick }) => {
        const Tag = onClick ? 'button' : 'span'
        return (
          <Tag
            key={word}
            role="listitem"
            aria-label={`${n} ${word}`}
            onClick={onClick}
            className={`flex-1 text-center border-[2.5px] border-ink rounded-[16px] px-2 py-2.5 shadow-[0_3px_0_#2E3A24] ${fill} ${
              onClick ? 'transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24]' : ''
            }`}
          >
            <span
              className={`block font-display font-black text-[23px] leading-none ${
                dark ? 'text-cream' : 'text-ink'
              }`}
            >
              {n}
            </span>
            {/* Full-strength ink/cream, no opacity. text-ink/70 on saffron computes
                to 2.97:1 — under AA — and it's the smallest type on the strip, which
                is exactly where a muted tint is least affordable. */}
            <span
              className={`block font-display font-bold text-[9.5px] uppercase tracking-[0.08em] leading-tight mt-1.5 ${
                dark ? 'text-cream' : 'text-ink'
              }`}
            >
              {word}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}
