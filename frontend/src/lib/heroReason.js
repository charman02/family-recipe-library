// WHY this recipe is the one in the Home hero.
//
// The hero is the biggest thing on the page, and without a reason it reads as an
// arbitrary pick — which is what prompted this. The fix isn't a magazine label
// ("Recipe of the week"): that claims editorial judgement nobody exercised, and at
// beta scale a global pick is transparently just one person's dish, which the
// people not picked would notice. Naming the ACTUAL reason is both true and
// personal, and the code already knows it.
//
// Order matters — it's a priority list, not a switch. A recipe someone handed you
// outranks everything, because that hand-off is the moment this app exists for.
//
// Deliberately NOT here: a stranger's recipe. Home was just reordered to put other
// people's public recipes BELOW the user's own kitchen (POSITIONING.md disclaims
// discovery-from-strangers), so putting one in the largest component on the page
// would reverse that more strongly than the old layout did. There's also no need:
// the hero only renders once the user has a recipe of their own, so there is no gap
// to fill.

const DAY = 24 * 60 * 60 * 1000

// `now` is injectable so the tests aren't a clock race.
export function heroReason(recipe, { shared = [], now = Date.now() } = {}) {
  if (!recipe) return null

  // 1 · Handed to you. The whole product in one line.
  if (shared.some((r) => r.id === recipe.id)) return 'Waiting for you'

  // 2 · You've cooked it before, so this is an invitation to do it again.
  //     NOTE this can't fire yet: nothing in the UI calls POST /{id}/cook, so
  //     last_cooked_at is null for every real user (see task #32). Written now so
  //     wiring cooking up lights it automatically rather than needing a second pass.
  if (recipe.last_cooked_at) return 'Cook it again'

  // 3 · Kept in the last week — still the thing they're thinking about.
  if (recipe.created_at && now - new Date(recipe.created_at).getTime() < 7 * DAY) {
    return 'Freshly kept'
  }

  // 4 · Nothing more specific is true. Says where it came from without pretending
  //     there's a reason it was singled out.
  return 'From your kitchen'
}
