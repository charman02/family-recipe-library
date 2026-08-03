// The always-available half of the ingredient autosuggest.
//
// It's a static module, not an endpoint, on purpose: the common case has to work
// on the first keystroke of a brand-new account, in a kitchen, on a phone with
// one bar. Nothing to fetch means nothing to wait for and nothing to fail. The
// user's OWN past ingredients arrive separately from
// GET /recipes/ingredient-suggestions and are merged in front of these.
//
// The list leans Asian home cooking because that's the cooking this app was built
// to preserve — a Filipino, Korean, Chinese, Japanese, Thai, Vietnamese or South
// Asian pantry should be one or two letters of typing, not eleven. Universal
// staples ride along so a non-Asian recipe isn't second-class.
//
// It is deliberately NOT exhaustive. This is a typing shortcut, not a taxonomy:
// a longer list would slow the match, crowd out the user's own words, and still
// miss the thing in their hand. Free text always wins — a name that isn't here
// types exactly as it did before.
//
// Lowercase throughout; matching is case-insensitive and the app doesn't
// title-case ingredient names anywhere.
export const COMMON_INGREDIENTS = [
  // sauces, pastes and seasonings — the backbone of the pantry
  'soy sauce',
  'dark soy sauce',
  'light soy sauce',
  'fish sauce',
  'oyster sauce',
  'hoisin sauce',
  'black bean sauce',
  'sesame oil',
  'chili oil',
  'chili crisp',
  'rice vinegar',
  'black vinegar',
  'shaoxing wine',
  'mirin',
  'sake',
  'gochujang',
  'gochugaru',
  'doenjang',
  'miso paste',
  'dashi',
  'kombu',
  'bonito flakes',
  'sambal oelek',
  'sriracha',
  'ponzu',
  'tamarind paste',
  'shrimp paste',
  'coconut milk',
  'coconut cream',
  'curry powder',
  'garam masala',
  'five spice powder',
  'star anise',
  'turmeric',
  'cumin',
  'ground coriander',
  'chili flakes',
  'furikake',
  'nori',
  'sesame seeds',
  'panko',
  'palm sugar',
  'msg',
  // aromatics and produce
  'garlic',
  'ginger',
  'scallions',
  'shallots',
  'onion',
  'red onion',
  'leeks',
  'lemongrass',
  'galangal',
  'kaffir lime leaves',
  'curry leaves',
  'bay leaves',
  'thai basil',
  'cilantro',
  'mint',
  'parsley',
  'green chilies',
  'red chilies',
  "bird's eye chilies",
  'bell pepper',
  'carrots',
  'celery',
  'daikon',
  'napa cabbage',
  'bok choy',
  'gai lan',
  'spinach',
  'mushrooms',
  'shiitake mushrooms',
  'wood ear mushrooms',
  'bean sprouts',
  'snow peas',
  'eggplant',
  'zucchini',
  'cucumber',
  'tomatoes',
  'potatoes',
  'sweet potato',
  'corn',
  'broccoli',
  'cabbage',
  'lime',
  'lemon',
  'kimchi',
  'pickled radish',
  'dried shrimp',
  // proteins
  'chicken thighs',
  'chicken breast',
  'whole chicken',
  'pork belly',
  'ground pork',
  'pork shoulder',
  'beef chuck',
  'ground beef',
  'beef short ribs',
  'lamb',
  'shrimp',
  'prawns',
  'white fish',
  'salmon',
  'squid',
  'clams',
  'mussels',
  'eggs',
  'firm tofu',
  'silken tofu',
  'fried tofu puffs',
  'tempeh',
  // grains, noodles and wrappers
  'jasmine rice',
  'short grain rice',
  'glutinous rice',
  'brown rice',
  'rice noodles',
  'egg noodles',
  'ramen noodles',
  'udon noodles',
  'rice vermicelli',
  'glass noodles',
  'all-purpose flour',
  'rice flour',
  'glutinous rice flour',
  'cornstarch',
  'potato starch',
  'bread',
  'wonton wrappers',
  'dumpling wrappers',
  'spring roll wrappers',
  // fats, dairy, liquids and baking basics
  'vegetable oil',
  'canola oil',
  'peanut oil',
  'olive oil',
  'butter',
  'ghee',
  'lard',
  'milk',
  'evaporated milk',
  'condensed milk',
  'heavy cream',
  'yogurt',
  'cheese',
  'water',
  'chicken stock',
  'beef stock',
  'vegetable stock',
  'salt',
  'kosher salt',
  'black pepper',
  'white pepper',
  'sugar',
  'brown sugar',
  'honey',
  'baking powder',
  'baking soda',
  'vanilla extract',
  'peanut butter',
  'peanuts',
  'cashews',
]

const MAX_MATCHES = 6

// Merge the user's own ingredient words in FRONT of the common list, deduped
// case-insensitively. Own words lead because a person's kitchen is a much
// stronger predictor of their next ingredient than any list we could ship —
// someone who writes "patis" every week should never be shown "parsley" first.
export function mergeSuggestions(userNames = [], common = COMMON_INGREDIENTS) {
  const out = []
  const seen = new Set()
  for (const name of [...userNames, ...common]) {
    const clean = (name || '').trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
  }
  return out
}

// Rank matches for what's been typed so far.
//
// Two tiers, and the tiering is the whole value: a name that STARTS with the
// query beats one that merely contains the query at a word boundary, so typing
// "so" offers "soy sauce" before "fish sauce". Matching mid-word is deliberately
// not supported — "hi" would otherwise pull up "chicken thighs", which reads as
// the app guessing wildly.
//
// An exact match returns nothing: there's no completion left to offer, and
// keeping the strip open would push the next field down for no reason.
export function matchIngredients(query, pool) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const starts = []
  const wordStarts = []
  for (const name of pool) {
    const lower = name.toLowerCase()
    // No early break on a full tier: an exact match can sit anywhere in the pool,
    // and stopping at MAX_MATCHES could walk past it and leave the strip open
    // under a name that's already finished.
    if (lower === q) return []
    if (lower.startsWith(q)) starts.push(name)
    else if (lower.split(/[\s-]+/).some((w) => w.startsWith(q))) wordStarts.push(name)
  }
  return [...starts, ...wordStarts].slice(0, MAX_MATCHES)
}
