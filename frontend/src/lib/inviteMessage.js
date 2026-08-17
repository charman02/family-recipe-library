// The default message a sender shares with an invite link.
//
// FIRST PERSON, on purpose: the message goes out from the sender's OWN texting app,
// under their name, so it should read like something they wrote ("Here's my adobo
// recipe…"), not an app notification that names them in the third person. The
// sender's name is therefore NOT in the text — their phone already carries it. (The
// link-preview CARD is separate and stays third person — that's the app narrating a
// caption, "Charlie passed you…"; see lib/inviteOg.js.)
//
// It seeds the note field (editable — the sender can rewrite it or clear it) and is
// also the fallback body when the native share sheet fires with no note typed.
// recipeName can be missing, so both branches stay clean, grammatical sentences.
export function defaultInviteMessage({ recipeName } = {}) {
  const dish = (recipeName || '').trim()
  // A yellow heart signs off the warmth — 💛 is the app's warm cue (palette
  // saffron; it fronted the old "you'd love this" opener). It's the sender's to
  // delete like any other word in the editable note.
  return dish
    ? `Here’s my ${dish} recipe — I wanted you to have it 💛`
    : 'Here’s my recipe — I wanted you to have it 💛'
}
