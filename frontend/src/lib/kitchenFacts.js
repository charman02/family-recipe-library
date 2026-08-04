// Derived views over the user's own recipes, for the Home page's explore sections.
//
// All of it is computed client-side from data Home ALREADY fetches — no new
// endpoints, no new columns. That's deliberate: the point of these sections is that
// the app is sitting on charming material (someone's amounts in their own words, the
// people a kitchen came from) which is currently buried three taps deep. Surfacing
// it needs presentation, not more schema.

import { isImprecise } from './measures'

// The person a recipe came from — the recorded source if there is one, else whoever
// wrote it down. Same rule as the bylines, so a face in the people row and the name
// on a card always agree.
export function personOf(recipe) {
  const source = (recipe.origin_attribution || '').split('·')[0].trim()
  return source || recipe.author_full_name || null
}

// Honorifics people actually type into the byline field. A first-word split would
// render "Auntie Ling" as "Auntie" and "Tita Baby" as "Tita" — the title survives and
// the person disappears, so three different aunties would all read the same. Kept as
// its own list because this is the app's most culturally specific field: Filipino,
// Chinese, Korean, Japanese, Spanish and Italian family titles all show up here.
const HONORIFICS = [
  'lola', 'lolo', 'tita', 'tito', 'auntie', 'aunty', 'aunt', 'uncle',
  'mama', 'mom', 'mum', 'papa', 'dad', 'nana', 'nonna', 'nonno', 'yaya',
  'grandma', 'grandpa', 'granny', 'gran', 'abuela', 'abuelo',
  'popo', 'gonggong', 'ahma', 'ama', 'halmoni', 'obaachan', 'ojiichan',
  'ate', 'kuya', 'mrs', 'mr', 'ms',
]

// The short label for a person in a tight space (an avatar caption, a chip).
//
// Keeps the honorific ONLY when it's all there is ("Lola" alone is a name), and
// otherwise returns the first real name word, so "Auntie Ling" reads as "Ling".
export function shortName(name) {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  const strip = (w) => w.replace(/[.,]/g, '').toLowerCase()
  const rest = words.filter((w) => !HONORIFICS.includes(strip(w)))
  return (rest[0] || words[0] || '').replace(/[.,]/g, '')
}

// WHOSE recipes live in this kitchen, most-recipes first.
//
// This is the section that's most this-app-only: issei models the person a dish came
// from, so it can group by them. A recipe box can't, and neither can any competitor
// that treats a recipe as a document with an author field.
export function peopleInKitchen(recipes) {
  const by = new Map()
  for (const r of recipes) {
    const name = personOf(r)
    if (!name) continue
    const entry = by.get(name) || { name, count: 0, recipes: [] }
    entry.count += 1
    entry.recipes.push(r)
    by.set(name, entry)
  }
  return [...by.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )
}

// Every amount nobody rounded off, and every per-step remark, as quotable lines.
//
// These two are the product's whole argument in miniature — "a good splash" survived
// as "a good splash", and someone's warning about the sugar came along with the
// recipe. Worth showing on the screen people open first.
export function quotableLines(recipes) {
  const out = []
  for (const r of recipes) {
    const person = personOf(r)
    for (const s of r.steps || []) {
      if (s.voice_note && s.voice_note.trim()) {
        out.push({
          kind: 'note',
          text: s.voice_note.trim(),
          person,
          recipe: r,
        })
      }
    }
    const ings = [
      ...(r.ingredients || []),
      ...(r.ingredient_sections || []).flatMap((s) => s.ingredients || []),
    ]
    for (const i of ings) {
      if (i.quantity_text && isImprecise(i)) {
        out.push({
          kind: 'amount',
          text: i.quantity_text,
          detail: i.name,
          person,
          recipe: r,
        })
      }
    }
  }
  return out
}

// Pick one line to show, varying by day rather than at random.
//
// Math.random() would change on every re-render — the card would flicker as you
// scrolled, and it would be untestable. Keying off the date means it's stable for a
// session, different tomorrow, and a pure function of (lines, day).
export function lineOfTheDay(lines, now = Date.now()) {
  if (!lines.length) return null
  const day = Math.floor(now / 86400000)
  return lines[day % lines.length]
}

// What a recipe is still missing. Ordered by how much the gap costs a RECIPIENT:
// a dish with no steps can't be cooked at all, while a missing photo is cosmetic.
// That ordering is the justification for showing these at all — a richer recipe
// makes a better handoff, so the nudge serves the product and not just the page.
// Labels name the thing that's missing, as a noun phrase. An earlier pass used a verb
// ("add the steps" / "add the story") and that was the defect: in the chip's small
// tracked uppercase, ADD THE STEPS and ADD THE STORY are near-identical shapes —
// same length, same first nine characters — so two different asks looked like the
// same row twice. Dropping the shared "ADD THE " prefix means the first letter you
// read is already the distinguishing one, and the words differ in length too.
//
// Each gap also carries an `icon` and a `tint`, because rows differing only in a few
// words of small type read as one repeated row. Deliberately NOT a severity scale
// (red/amber/green would grade someone's grandmother's recipe) — the list order
// already carries priority, so these just say WHICH KIND.
const GAPS = [
  {
    key: 'steps',
    label: 'how it’s made',
    icon: 'list',
    tint: 'bg-peach',
    test: (r) => !(r.steps || []).length,
  },
  {
    key: 'story',
    label: 'the story behind it',
    icon: 'book',
    tint: 'bg-saffron',
    test: (r) => !(r.story && r.story.trim()),
  },
  {
    key: 'notes',
    label: 'a note on a step',
    icon: 'note',
    tint: 'bg-sage',
    test: (r) =>
      (r.steps || []).length > 0 &&
      !(r.steps || []).some((s) => s.voice_note && s.voice_note.trim()),
  },
  {
    key: 'photo',
    label: 'a photo',
    icon: 'camera',
    tint: 'bg-line',
    test: (r) => !r.cover_photo_url,
  },
]

export function unfinished(recipes, limit = 3) {
  const out = []
  for (const r of recipes) {
    const gap = GAPS.find((g) => g.test(r))
    if (gap) {
      out.push({
        recipe: r,
        gap: gap.key,
        label: gap.label,
        icon: gap.icon,
        tint: gap.tint,
      })
    }
  }
  // Sort by gap severity, using the order GAPS is declared in.
  const rank = (g) => GAPS.findIndex((x) => x.key === g)
  return out.sort((a, b) => rank(a.gap) - rank(b.gap)).slice(0, limit)
}

// The stat strip under the hero.
//
// `theirWords` counts the amounts nobody rounded off plus the remarks left on
// steps — the one number here that no other recipe app could show, because every
// other one converted those to grams on the way in. It replaced a cooks pill that
// read from cook_count, which is 0 for every real user (nothing in the UI calls the
// cook endpoint yet, task #32) and so was a proud zero pretending to be a stat.
//
// cooks is still returned so the strip can pick it up the moment cooking is wired.
export function kitchenGlance(recipes) {
  const cooks = recipes.reduce((n, r) => n + (r.cook_count || 0), 0)
  return {
    recipes: recipes.length,
    people: peopleInKitchen(recipes).length,
    theirWords: quotableLines(recipes).length,
    cooks,
  }
}
