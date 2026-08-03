// The ONLY place in the app that touches the Web Speech API.
//
// It's a module rather than inline component code for two reasons that both cost
// us something the first time round:
//   1. jsdom implements no part of the Web Speech API, so a component that
//      reached for `window.SpeechRecognition` itself would be untestable — and
//      untestable is how a feature like this rots silently. Everything below
//      reads the constructor off `window` at CALL time (never at import time), so
//      a test can install a fake, take it away again, and exercise both the
//      supported and the unsupported path in the same file.
//   2. The vendor prefix. Chrome/Edge/Safari expose `webkitSpeechRecognition`;
//      the unprefixed name is not universal. One lookup, one place to fix.
//
// Nothing here keeps or transmits sound. The browser's own recognizer hands back
// text and the utterance is discarded — there is no recording anywhere in this
// product, and no copy in the UI may suggest otherwise (see POSITIONING.md).

export function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// Firefox has no implementation at all. Callers must render NOTHING when this is
// false — not a disabled button, not an explanation. An affordance that can't do
// what it depicts is worse than a missing one, and there is nothing the user
// could act on anyway.
export function isDictationSupported() {
  return getRecognitionCtor() !== null
}

/**
 * Start one dictation session. Returns a controller, or null if dictation isn't
 * available (unsupported browser, or the recognizer refused to start).
 *
 * onResult receives `{ final, interim }` for each event: `final` is text the
 * recognizer has committed to, `interim` is its current guess and will be
 * replaced or withdrawn. Callers should only persist `final`.
 */
export function startDictation({ lang, onResult, onError, onEnd } = {}) {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null

  const rec = new Ctor()
  // `lang` is deliberately left unset unless a caller asks for one, so the
  // browser falls back to the page/user locale. Hardcoding en-US would quietly
  // mangle dictation for exactly the cooks this app is for — someone describing
  // a Tagalog or Korean dish in their own language — and the app has no language
  // preference to read from yet.
  if (lang) rec.lang = lang
  // continuous = false ends the session on a pause, which is the behaviour the
  // flow promises ("stops on silence or a second tap"). It also means a mic that
  // someone tapped and walked away from cannot stay open indefinitely.
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1

  rec.onresult = (event) => {
    let final = ''
    let interim = ''
    // Iterate from resultIndex: the results list is cumulative across events, so
    // reading it from 0 would re-deliver — and therefore re-append — every
    // sentence already committed to the field.
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      const text = result?.[0]?.transcript || ''
      if (result?.isFinal) final += text
      else interim += text
    }
    onResult?.({ final, interim })
  }
  rec.onerror = (event) => onError?.(event?.error || 'unknown')
  rec.onend = () => onEnd?.()

  try {
    rec.start()
  } catch {
    // Chrome throws InvalidStateError if start() lands on a recognizer that is
    // already running. Reporting "couldn't start" is honest and recoverable;
    // letting it throw would take the whole form down mid-entry.
    return null
  }

  return {
    // A graceful stop: the recognizer flushes a final result, then fires onend.
    stop() {
      try {
        rec.stop()
      } catch {
        // Already stopped — nothing to do.
      }
    },
    // Teardown. abort() rather than stop() because stop() still delivers a final
    // result and an onend, i.e. callbacks into a component that has unmounted;
    // and the handlers are detached first so an in-flight event can't arrive
    // after the caller has gone.
    abort() {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        // Already finished — nothing to do.
      }
    },
  }
}

// Dictated text is APPENDED, never assigned. Someone who has typed two sentences
// and then taps the mic — deliberately or by mis-tap — must not lose them; that
// is the single worst thing this feature could do. Spacing is preserved rather
// than normalized: if they left a trailing newline, the dictated sentence starts
// on that new line.
export function appendDictated(existing, addition) {
  const add = (addition || '').trim()
  if (!add) return existing || ''
  const base = existing || ''
  if (!base) return add
  return /\s$/.test(base) ? base + add : `${base} ${add}`
}
