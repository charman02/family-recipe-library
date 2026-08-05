import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import {
  appendDictated,
  isDictationSupported,
  startDictation,
} from '../lib/speech'

// Speak into a long-text field instead of typing it.
//
// Both rounds of user testing named typing as the most tedious part of the app,
// and one tester abandoned the add flow partway through it. The fields people
// skip are the ones needing real sentences — the story and the per-step remarks —
// so those are where this goes. Short fields (an ingredient name, an amount)
// already have autosuggest and unit chips and are faster to tap than to say.
//
// WHAT THIS IS NOT: the browser transcribes and the utterance is thrown away.
// Nothing is captured, stored, sent or played back. Every string below is
// therefore written to describe DICTATION and never capture — "record", "voice"
// and "audio" are banned outright (POSITIONING.md), and a test asserts they
// appear nowhere in what this renders. That test is the point: this repo has
// shipped copy claiming sound it doesn't have more than once.
//
// Always rendered, never focus-revealed. Three features in this codebase have
// been missed by testers (the step check-off took three attempts before people
// could find it), and a control that appears only on focus is a control most
// people never learn exists. "Quiet" is carried by size and restraint instead.

// Failure copy, in the app's own register: say what happened, then hand back the
// way that always works. No error codes, no blame, no "please".
const PROBLEMS = {
  'not-allowed': 'Dictation needs permission from your browser. You can type this instead.',
  'service-not-allowed':
    'Dictation needs permission from your browser. You can type this instead.',
  'no-speech': 'Didn’t catch anything. Try again, or type it.',
  network: 'Dictation needs a connection. You can type this instead.',
}
const PROBLEM_FALLBACK = 'Dictation stopped. You can type this instead.'

// `bottomClass` lets a multi-line textarea nudge the glyph up so its gap to the
// bottom border matches its gap to the right border. A single-line input is short
// enough that bottom-2 already reads centered; a rows={2}/{3} textarea makes the
// same offset look low.
export default function DictateButton({
  value,
  onChange,
  what,
  bottomClass = 'bottom-2',
  // What joins each utterance to what's already there. A newline where each utterance
  // is its own ITEM (the paste box); the default space is right for prose, where you're
  // dictating one continuous sentence into a story or a step.
  separator = ' ',
}) {
  const [listening, setListening] = useState(false)
  // The recognizer's current GUESS. Held here and shown beside the field rather
  // than written into it — see the note on commit() below.
  const [interim, setInterim] = useState('')
  const [problem, setProblem] = useState('')
  const sessionRef = useRef(null)

  // The live field value, readable from inside the recognizer's callbacks. The
  // `value` prop is captured per-render and those callbacks outlive the render
  // that created them, so appending against the prop directly would overwrite
  // anything typed after dictation started. Advanced eagerly in commit() too, so
  // two final results arriving in one tick both land instead of the second
  // clobbering the first via a stale read.
  const valueRef = useRef(value)
  valueRef.current = value

  // Unmounting mid-dictation must abort, not stop: a removed step row whose
  // recognizer is still open would keep the browser listening — mic indicator
  // lit, no visible field — and then fire a final result into a dead component.
  // abort() detaches the handlers first, so nothing arrives after we're gone.
  useEffect(
    () => () => {
      sessionRef.current?.abort()
      sessionRef.current = null
    },
    [],
  )

  // Unsupported browsers (Firefox has no implementation) get NOTHING — no
  // button, no disabled control, no explanation. There is no action to offer, and
  // a dead affordance shaped like a working one is worse than its absence: it
  // reads as the app being broken rather than the browser lacking a feature.
  if (!isDictationSupported()) return null

  function commit(text) {
    // Only FINAL text reaches the field. Interim results are the recognizer
    // thinking aloud — they get revised and withdrawn mid-sentence — and writing
    // them into the value would (a) flicker the field on every packet and (b)
    // leave a half-guessed fragment saved in the recipe if the user tapped away,
    // navigated, or removed the row before the utterance resolved. The field
    // holds committed text only; liveness is carried by the preview line, which
    // is ephemeral by construction because it lives in local state.
    const next = appendDictated(valueRef.current, text, separator)
    valueRef.current = next
    onChange(next)
  }

  function stop() {
    // Graceful stop, so a sentence in progress is still flushed as a final
    // result. onEnd clears the listening state.
    sessionRef.current?.stop()
  }

  function start() {
    setProblem('')
    setInterim('')
    const session = startDictation({
      onResult: ({ final, interim: guess }) => {
        if (final) commit(final)
        setInterim(guess)
      },
      onError: (code) => {
        // The button must never be left stuck mid-listen. onend does not always
        // follow onerror across browsers, so clear the state here as well; both
        // paths are idempotent.
        setProblem(PROBLEMS[code] || PROBLEM_FALLBACK)
        setInterim('')
        setListening(false)
        sessionRef.current = null
      },
      onEnd: () => {
        setInterim('')
        setListening(false)
        sessionRef.current = null
      },
    })
    if (!session) {
      // Support was there a moment ago but start() refused — treat it as any
      // other failure rather than throwing out of an event handler.
      setProblem(PROBLEM_FALLBACK)
      return
    }
    sessionRef.current = session
    setListening(true)
  }

  const label = listening ? `Stop dictating ${what}` : `Dictate ${what}`

  return (
    <>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={label}
        aria-pressed={listening}
        title={label}
        // Quiet by size, not by hiding: a 32px round outline, the same terra the
        // A bare glyph, no disc: the outlined circle sat ON the field's own border
        // and read as a chip stuck to the edge of the box rather than a control
        // inside it. Sits in the bottom-right corner; the fields it attaches to
        // carry matching right padding so text never runs beneath it. The rounded
        // hit area is still 28px so it stays a real touch target.
        className={`absolute right-2 ${bottomClass} w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
          listening ? 'text-terra' : 'text-terra/60 hover:text-terra'
        }`}
      >
        {/* The glyph CHANGES shape between states (mic outline → stop square) and
            the status line below spells the state out in words. Colour alone has
            carried a state twice in this codebase and been wrong twice. */}
        <Icon
          name={listening ? 'stop' : 'mic'}
          className={listening ? 'w-[17px] h-[17px]' : 'w-[18px] h-[18px]'}
        />
      </button>

      {/* Status line. Announced politely — it's the state change a screen-reader
          user needs. The GUESS beside it is not announced: it is superseded
          several times a second, and the committed text lands in the field where
          a screen reader reads it anyway. */}
      {(listening || problem) && (
        <p className="mt-1 flex items-baseline gap-1.5" aria-live="polite">
          {problem ? (
            <span className="error-pill">{problem}</span>
          ) : (
            <>
              <span className="font-display font-bold text-[11.5px] uppercase tracking-[0.1em] text-terra">
                Dictating…
              </span>
              {interim && (
                <span
                  aria-hidden="true"
                  className="font-display italic text-[12px] text-ink-soft truncate"
                >
                  {interim}
                </span>
              )}
            </>
          )}
        </p>
      )}
    </>
  )
}
