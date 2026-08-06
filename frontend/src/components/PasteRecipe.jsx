import { useState } from 'react'
import BackButton from './BackButton'
import DictateButton from './DictateButton'
import { parseRecipeText } from '../lib/parseRecipeText'
import { isDictationSupported } from '../lib/speech'

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

      {/* ONE rule, in one line.
          A first pass listed three rules, each with an em-dashed explanation — six
          lines of small type between the heading and the box, which is a lot of
          reading on the screen whose whole promise is "this is the fast way".
          What survived is the only rule the parser genuinely depends on: it is
          line-based, so run-on prose is the one input no heuristic can split
          ("tamarind, a thumb of ginger, and some kangkong" is three ingredients on
          one line).
          The other two were cut because the PLACEHOLDER already teaches them by
          example — it shows folk amounts ("a good splash of vinegar") and shows
          ingredients before steps — and a shown format is copied more reliably than
          a stated one. Their failure modes are also both recoverable: an amount in
          the wrong shape still lands in the right field, and out-of-order lines are
          fixed by the touch rule or by one tap on the form that follows. */}
      <p className="font-display italic text-[14.5px] text-ink-soft mt-2">
        One thing per line &mdash; an ingredient or a step. Amounts however you say
        them.
      </p>

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

      {/* Only shown where a mic exists. Firefox has no Web Speech implementation and
          DictateButton renders nothing there, so this advice was addressing a control
          that wasn't on the page. Gated on the same check rather than a guess. */}
      {isDictationSupported() && (
        <p className="font-display italic text-[12.5px] text-ink-soft mt-2">
          Using the mic? Pause between each one &mdash; every pause starts a new line.
        </p>
      )}

      {tooThin && (
        <p className="error-pill mt-3">
          That looks like just a name &mdash; add the ingredients or the steps too.
        </p>
      )}

      {/* "Nothing is saved yet" was a third line of small print under the button. It
          matters — it's what makes trusting the parser cheap — so it moved INTO the
          button's own second line, where it's read as part of the action instead of
          competing with two other captions. */}
      <button
        onClick={handleSort}
        disabled={lines < 2}
        className="btn-primary mt-4 flex flex-col items-center py-2.5"
      >
        <span>Sort this out &rarr;</span>
        <span className="font-display italic font-normal text-[12px] text-cream/85 mt-0.5">
          Nothing is saved until you say so
        </span>
      </button>
    </div>
  )
}
