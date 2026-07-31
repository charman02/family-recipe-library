// The client-side preferences bag — the same `issei_prefs` object Profile's
// display toggles live in.
//
// Deliberately NOT a second onboarding-only localStorage key: one bag means
// "clear site data" resets every client-side preference together, and there is no
// chance of two keys disagreeing about what a fresh user is. Profile still has
// its own inline reader (it predates this module and isn't ours to refactor); the
// contract between them is the key name and the fact that writes merge.
export const PREFS_KEY = 'issei_prefs'

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    // A hand-edited or half-written value shouldn't brick the app; an unreadable
    // bag is treated as an empty one.
    return {}
  }
}

// Read-modify-write against STORAGE, not against a caller's cached copy: Profile
// holds prefs in React state, so writing a stale snapshot back would silently
// revert whichever toggle it was holding.
export function setPref(key, value) {
  const next = { ...loadPrefs(), [key]: value }
  localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  return next
}
