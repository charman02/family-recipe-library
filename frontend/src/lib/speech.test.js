import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  appendDictated,
  getRecognitionCtor,
  isDictationSupported,
  startDictation,
} from './speech'

// jsdom implements no part of the Web Speech API, which is precisely why the
// access is funnelled through this module: a fake goes on `window` here and the
// whole feature becomes exercisable — including the unsupported path, which is
// jsdom's own default and therefore free to test.
class FakeRecognition {
  static instances = []
  static failStart = false

  constructor() {
    FakeRecognition.instances.push(this)
    this.aborted = false
    this.stopped = false
    this.started = false
  }

  start() {
    if (FakeRecognition.failStart) throw new Error('InvalidStateError')
    this.started = true
  }

  stop() {
    this.stopped = true
  }

  abort() {
    this.aborted = true
  }
}

function install({ prefixed = false } = {}) {
  FakeRecognition.instances = []
  FakeRecognition.failStart = false
  window[prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition'] =
    FakeRecognition
  return FakeRecognition
}

// Shapes a browser `onresult` event. The results list is CUMULATIVE in the real
// API and `resultIndex` says where the new material starts — the bug this guards
// is reading from 0 and re-appending every sentence already committed.
function resultEvent(items, resultIndex = 0) {
  const results = items.map(({ transcript, isFinal }) => {
    const alternatives = [{ transcript }]
    alternatives.isFinal = !!isFinal
    return alternatives
  })
  return { resultIndex, results }
}

afterEach(() => {
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
})

describe('speech support detection', () => {
  it('reports unsupported when the browser has no implementation', () => {
    // Firefox. Callers must render nothing at all in this state.
    expect(getRecognitionCtor()).toBeNull()
    expect(isDictationSupported()).toBe(false)
  })

  it('finds the webkit-prefixed constructor too', () => {
    // Chrome, Edge and Safari all still expose only the prefixed name; missing
    // it would report "unsupported" on every browser that actually works.
    install({ prefixed: true })
    expect(isDictationSupported()).toBe(true)
    expect(getRecognitionCtor()).toBe(FakeRecognition)
  })

  it('reads the constructor at call time, not at import time', () => {
    // The module is imported once per test file; if support were captured at
    // import it would be frozen as "unsupported" forever and no test below could
    // run. This is the property that makes the seam usable.
    expect(isDictationSupported()).toBe(false)
    install()
    expect(isDictationSupported()).toBe(true)
  })
})

describe('startDictation', () => {
  it('returns null without starting anything when unsupported', () => {
    expect(startDictation({ onResult: vi.fn() })).toBeNull()
  })

  it('returns null instead of throwing when start() is refused', () => {
    // Chrome throws InvalidStateError on a recognizer that is already running.
    // Escaping out of a click handler would take the whole add form down.
    install()
    FakeRecognition.failStart = true
    expect(() => startDictation({})).not.toThrow()
    expect(startDictation({})).toBeNull()
  })

  it('separates the committed transcript from the running guess', () => {
    install()
    const onResult = vi.fn()
    startDictation({ onResult })
    const rec = FakeRecognition.instances[0]
    rec.onresult(
      resultEvent([
        { transcript: 'Brown the chicken. ', isFinal: true },
        { transcript: 'then add the vine', isFinal: false },
      ]),
    )
    expect(onResult).toHaveBeenCalledWith({
      final: 'Brown the chicken. ',
      interim: 'then add the vine',
    })
  })

  it('ignores results before resultIndex, so nothing is delivered twice', () => {
    install()
    const onResult = vi.fn()
    startDictation({ onResult })
    const rec = FakeRecognition.instances[0]
    // A second event whose list still carries the first sentence. Reading from 0
    // would hand back both and duplicate the opening line in the field.
    rec.onresult(
      resultEvent(
        [
          { transcript: 'Brown the chicken.', isFinal: true },
          { transcript: 'Add the vinegar.', isFinal: true },
        ],
        1,
      ),
    )
    expect(onResult).toHaveBeenCalledWith({
      final: 'Add the vinegar.',
      interim: '',
    })
  })

  it('reports the error code and the end of a session', () => {
    install()
    const onError = vi.fn()
    const onEnd = vi.fn()
    startDictation({ onError, onEnd })
    const rec = FakeRecognition.instances[0]
    rec.onerror({ error: 'not-allowed' })
    rec.onend()
    expect(onError).toHaveBeenCalledWith('not-allowed')
    expect(onEnd).toHaveBeenCalled()
  })

  it('ends on a pause rather than listening indefinitely', () => {
    // continuous=false is what makes "stops on silence" true, and what stops a
    // mic someone tapped and walked away from from staying open.
    install()
    startDictation({})
    expect(FakeRecognition.instances[0].continuous).toBe(false)
    expect(FakeRecognition.instances[0].interimResults).toBe(true)
  })

  it('leaves the language to the browser unless one is asked for', () => {
    // Hardcoding en-US would mangle dictation for someone describing a dish in
    // the language they cook it in.
    install()
    startDictation({})
    expect(FakeRecognition.instances[0].lang).toBeUndefined()
    startDictation({ lang: 'ko-KR' })
    expect(FakeRecognition.instances[1].lang).toBe('ko-KR')
  })

  it('stop() flushes gracefully; abort() detaches the handlers first', () => {
    install()
    const onEnd = vi.fn()
    const session = startDictation({ onEnd })
    const rec = FakeRecognition.instances[0]

    session.stop()
    expect(rec.stopped).toBe(true)

    session.abort()
    expect(rec.aborted).toBe(true)
    // The teardown guarantee: a late event from the browser cannot reach a caller
    // that has already gone away.
    expect(rec.onresult).toBeNull()
    expect(rec.onerror).toBeNull()
    expect(rec.onend).toBeNull()
  })

  it('survives a recognizer that throws on stop or abort', () => {
    install()
    const session = startDictation({})
    const rec = FakeRecognition.instances[0]
    rec.stop = () => {
      throw new Error('already stopped')
    }
    rec.abort = () => {
      throw new Error('already stopped')
    }
    expect(() => session.stop()).not.toThrow()
    expect(() => session.abort()).not.toThrow()
  })
})

// Appending is the whole safety property of this feature: a mis-tap on the mic
// must never be able to cost someone the sentences they typed.
describe('appendDictated', () => {
  it('appends to existing text with a single space', () => {
    expect(appendDictated('I made this.', 'My mother taught me.')).toBe(
      'I made this. My mother taught me.',
    )
  })

  it('never replaces what is already there', () => {
    const existing = 'Two sentences the user typed. Do not lose them.'
    expect(appendDictated(existing, 'And one more.')).toContain(existing)
  })

  it('respects the whitespace the user left, rather than normalizing it', () => {
    // A trailing newline means they wanted the next thought on its own line.
    expect(appendDictated('First thought.\n', 'Second.')).toBe(
      'First thought.\nSecond.',
    )
    expect(appendDictated('Trailing space ', 'next')).toBe('Trailing space next')
  })

  it('adds nothing for an empty or whitespace-only transcript', () => {
    // A recognizer that heard nothing must not leave a stray space behind.
    expect(appendDictated('Kept text.', '')).toBe('Kept text.')
    expect(appendDictated('Kept text.', '   ')).toBe('Kept text.')
    expect(appendDictated('Kept text.', undefined)).toBe('Kept text.')
  })

  it('starts an empty field with the transcript alone, un-padded', () => {
    expect(appendDictated('', '  Brown the chicken.  ')).toBe(
      'Brown the chicken.',
    )
    expect(appendDictated(undefined, 'Brown the chicken.')).toBe(
      'Brown the chicken.',
    )
  })

  it('joins with a newline when each utterance is its own ITEM', () => {
    // The paste box needs this, and its absence made dictation there actively broken:
    // three utterances space-joined into one line, which the line-based parser read as
    // a very long dish name with zero ingredients and zero steps. A space is still the
    // default, because a story or a step is prose.
    let v = ''
    for (const said of ['Adobo', '3 soup spoons soy sauce', 'Brown the chicken']) {
      v = appendDictated(v, said, '\n')
    }
    expect(v).toBe('Adobo\n3 soup spoons soy sauce\nBrown the chicken')
  })

  it('does not double a separator when the text already ends in whitespace', () => {
    expect(appendDictated('Adobo\n', '2 cups rice', '\n')).toBe('Adobo\n2 cups rice')
  })
})
