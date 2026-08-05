import { useState } from 'react'
import BackButton from './BackButton'
import DictateButton from './DictateButton'
import { parseRecipeText } from '../lib/parseRecipeText'

// Paste (or dictate) a whole recipe at once, instead of filling 19 fields.
//
// This is an OPTIONAL door, never the default. Two reasons it isn't imposed:
//   1. It only works on structured text. Dictated run-on prose defeats any line-based
//      parser — "you need tamarind, a thumb of ginger, and some kangkong" is one line
//      holding three ingredients — and someone who hit that unasked would conclude the
//      app is broken.
//   2. A parser that's confidently wrong costs MORE than typing: you proofread AND
//      re-sort. So this screen hands off to the ordinary form with everything pre-filled
//      and editable, rather than saving anything on its own.
//
// The mic is here for the same reason it's on the story field — speaking is faster than
// typing on a phone — with the honest caveat that dictating a LIST (one item per line)
// parses well while dictating a paragraph does not. The hint says so.
export default function PasteRecipe({ onParsed, onBack, initialText = '' }) {
  // Seeded from the parent so going back from the form returns the SAME text. Held
  // locally as well so typing doesn't re-render the whole flow on every keystroke.
  const [text, setText] = useState(initialText)
  const [tooThin, setTooThin] = useState(false)

  const lines = text.split('\n').filter((l) => l.trim()).length

  function handleSort() {
    const parsed = parseRecipeText(text)
    // Nothing recognisable: a single line is a dish name, not a recipe. Say so here
    // rather than dropping someone into an empty form and letting them wonder what
    // happened to their text.
    if (!parsed.ingredients.length && !parsed.steps.length) {
      setTooThin(true)
      return
    }
    onParsed(parsed, text)
  }

  return (
    <div className="min-h-screen bg-cream px-[18px] pt-5 pb-10">
      <div className="mb-4">
        <BackButton onClick={onBack} label="Back" />
      </div>

      <h1 className="font-display font-black text-[28px] text-ink leading-tight">
        Paste it in, or say it
      </h1>

      {/* THREE RULES, not vague encouragement.
          The parser is line-based, so its accuracy depends entirely on how the text is
          shaped — and every one of its measured failures traces to a rule broken here.
          Saying so up front costs three lines and converts the two known failure modes
          into things the user can simply avoid:
            · "one per line" is the whole contract; run-on prose is the one input no
              heuristic can split ("tamarind, a thumb of ginger, and some kangkong").
            · "amounts in your own words" pre-empts the assumption that this wants
              grams — the opposite of what the app is for.
            · "ingredients first" is what lets a bare noun with no amount ("tamarind")
              be recognised at all: it's read from its neighbours. */}
      <ul className="mt-3 mb-1 space-y-1.5">
        {[
          ['One thing per line', 'an ingredient or a step — not a paragraph'],
          ['Amounts however you say them', '“a good splash” beats 15 ml'],
          ['Ingredients first, then the steps', 'the usual order is the easy one'],
        ].map(([rule, why]) => (
          <li key={rule} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className="flex-none mt-[7px] w-2 h-2 rounded-full bg-terra"
            />
            <span className="min-w-0">
              <span className="font-display font-bold text-[14px] text-ink leading-snug">
                {rule}
              </span>
              <span className="font-display italic text-[13px] text-ink-soft">
                {' '}
                — {why}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="relative mt-4">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setTooThin(false)
          }}
          rows={13}
          autoFocus
          className="field font-sans text-[14.5px] leading-relaxed resize-y"
          // The placeholder is the fourth rule, shown rather than stated: it IS a
          // correctly-shaped recipe, headers and all, so the format can be copied
          // instead of parsed out of instructions.
          placeholder={`Chicken Adobo

3 soup spoons soy sauce
a good splash of vinegar
a whole head of garlic

Brown the chicken skin-side down
Add the soy and vinegar
Simmer until the sauce coats a spoon`}
        />
        {/* separator="\n" — each dictated utterance is its own LINE here, not the next
            words of a sentence. With the default space join, saying "Adobo", then
            "three soup spoons soy sauce", then "brown the chicken" collapsed into one
            line, which the parser read as a very long dish name with zero ingredients
            and zero steps. So the mic was inviting the exact input that can't work. */}
        <DictateButton
          value={text}
          onChange={(next) => {
            setText(next)
            setTooThin(false)
          }}
          what="the recipe"
          separator={'\n'}
          bottomClass="bottom-3.5"
        />
      </div>

      <p className="font-display italic text-[12.5px] text-ink-soft mt-2">
        Using the mic? Pause between each one — every pause starts a new line.
      </p>

      {tooThin && (
        <p className="error-pill mt-3">
          That looks like just a name — add the ingredients or the steps too.
        </p>
      )}

      <button
        onClick={handleSort}
        disabled={lines < 2}
        className="btn-primary mt-4"
      >
        Sort this out &rarr;
      </button>

      <p className="font-display italic text-[12.5px] text-ink-soft/90 mt-3 text-center">
        Nothing is saved yet &mdash; you&rsquo;ll see it all before it is.
      </p>
    </div>
  )
}
