// One-tap note starters that carry the sender's intent. The app never guesses
// intent from the recipient's identity — the note carries it.
//
// The "Add the part I'm missing" starter was removed: it framed the handoff as
// asking the recipient to complete/edit the recipe, but a recipient can't edit
// (read is not write), and the product's sharing purpose is simply to give a
// personal dish to someone who's never had it. If a "fill in what I'm missing"
// flow is ever wanted, it's a real feature (a request back to the source), not a
// note starter. So the starters are just warm openers now.
export const HANDOFF_STARTERS = [
  {
    key: 'love',
    label: '💛 You’d love this',
    note: 'You’d love this — I wanted you to have it.',
  },
  {
    key: 'made',
    label: '🍳 I made this for you',
    note: 'I made this for you — here’s how, so you can make it too.',
  },
]

// No auto-selected starter: the note is optional and its intent is the sender's to
// choose. (Previously the fill-in starter auto-armed when passing back to the
// recorded source; that starter is gone.)
export function defaultStarterKey() {
  return null
}
