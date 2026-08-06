import { useState } from 'react'
import BackButton from './BackButton'
import DictateButton from './DictateButton'
import { parseRecipeText } from '../lib/parseRecipeText'
import { isDictationSupported } from '../lib/speech'
import { parseRecipeWithAI } from '../api/sharing'

// Say or paste a whole recipe at once, instead of filling 19 fields.
//
// TWO PARSERS, in order. The server asks a language model first (POST /recipes/parse);
// if that's unavailable it falls back to the local line-based parser. The order matters
// because they fail on different inputs:
//   · the local parser needs one item per line, and cannot split run-on speech —
//     "you need tamarind, about a thumb of ginger, and some kangkong" is one line
//     holding three ingredients. That is exactly how someone TALKS about cooking.
//   · the model splits that trivially, and also picks out servings, cuisine, the person
//     it came from, and a remark attached to a step.
// So the model is what makes this door work for speech rather than only for tidy text,
// and the local parser is what keeps the door working when the model is down, out of
// credit, or unconfigured. Nobody sees an error either way.
//
// Neither one SAVES anything: both hand off to the ordinary form, pre-filled and
// editable. A parser that's confidently wrong costs more than typing — you proofread
// and re-sort — so the last word stays with the user.
// Map the server's parse response onto the shape the local parser already returns, so
// the screen after this one doesn't care which parser produced its values. Extending the
// shape rather than replacing it also means the model's extra fields (servings, cuisine,
// the person it came from, a note per step) simply arrive as `undefined` on the local
// path instead of needing a second code path in the form.
function fromAI(data) {
  return {
    name: data.name || '',
    ingredients: (data.ingredients || []).map((i) => ({
      name: i.name,
      amount: i.amount || '',
      quantity_type: i.quantity_type,
    })),
    // The local parser returns steps as plain strings; the model gives each one an
    // optional note. Objects here, normalised by the caller.
    steps: (data.steps || []).map((s) => ({ content: s.content, note: s.note || '' })),
    sourceName: data.source_name || '',
    description: data.description || '',
    servings: data.servings || '',
    cuisine: data.cuisine || '',
    // The model classified nothing by guesswork — the server re-typed every amount with
    // the app's own classifier — so there is no "we guessed N lines" to confess.
    usedHeaders: true,
    guessedLines: 0,
    viaAI: true,
  }
}

export default function PasteRecipe({ onParsed, onBack, initialText = '' }) {
  // Seeded from the parent so going back from the form returns the SAME text. Held
  // locally as well so typing doesn't re-render the whole flow on every keystroke.
  const [text, setText] = useState(initialText)
  const [tooThin, setTooThin] = useState(false)
  const [working, setWorking] = useState(false)

  // Enough to be worth sending, measured in WORDS rather than lines.
  //
  // It required two lines while only the line-based parser existed, which was
  // reasonable then and became a real bug the moment the model went in front of it: the
  // gate blocked exactly the input this feature was built for. "sinigang, you need
  // tamarind, a thumb of ginger, and some kangkong" is ONE line and a whole recipe, and
  // the Sort button sat disabled on it. Words instead — a lone dish name is still
  // refused, and anything a person actually said gets through.
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const enough = words >= 4

  async function handleSort() {
    if (working) return
    setWorking(true)
    try {
      // The model first. A network failure is NOT an error the user should see — the
      // local parser is right there and produces something usable — so this catch is
      // deliberately silent. `ai: false` from the server means the same thing: the key
      // is missing, or OpenRouter is down or rate-limited.
      let parsed = null
      try {
        const { data } = await parseRecipeWithAI(text)
        if (data?.ai && (data.ingredients?.length || data.steps?.length)) {
          parsed = fromAI(data)
        }
      } catch {
        // fall through to the local parser
      }

      if (!parsed) parsed = parseRecipeText(text)

      // Nothing recognisable either way: a single line is a dish name, not a recipe.
      // Say so rather than dropping someone into an empty form and letting them wonder
      // what happened to their text.
      if (!parsed.ingredients.length && !parsed.steps.length) {
        setTooThin(true)
        return
      }
      onParsed(parsed, text)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream px-[18px] pt-5 pb-10">
      <div className="mb-4">
        <BackButton onClick={onBack} label="Back" />
      </div>

      <h1 className="font-display font-black text-[28px] text-ink leading-tight">
        Paste it in, or say it
      </h1>

      {/* The instruction changed when the model went in front of the local parser.
          It used to say "one thing per line", because that was a hard requirement:
          the line-based parser cannot split "tamarind, a thumb of ginger, and some
          kangkong" into three ingredients. The model can, so demanding tidy lines
          would now be asking for work the app no longer needs — and it was the one
          thing standing between this door and the way people actually talk.
          "However you like" is honest in both cases: with the model it's true
          outright, and without it the local parser still handles the tidy shape the
          placeholder demonstrates. What isn't said is anything about AI — the
          promise a user cares about is that they can talk normally, not which
          machine read it. */}
      <p className="font-display italic text-[14.5px] text-ink-soft mt-2">
        However you like &mdash; a tidy list, or just how you&rsquo;d tell someone.
        Amounts in your own words.
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

      {/* Only shown where a mic exists — Firefox has no Web Speech implementation and
          DictateButton renders nothing there, so this was previously advice about a
          control that wasn't on the page.
          It used to say "pause between each one", because each pause starts a new line
          and the local parser needed one item per line. That requirement is gone now
          that the model reads it, so the hint says the useful thing instead: keep
          talking. */}
      {isDictationSupported() && (
        <p className="font-display italic text-[12.5px] text-ink-soft mt-2">
          Tap the mic and just talk &mdash; you don&rsquo;t have to be tidy about it.
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
        disabled={!enough || working}
        className="btn-primary mt-4 flex flex-col items-center py-2.5"
      >
        <span>{working ? 'Sorting it out…' : 'Sort this out →'}</span>
        <span className="font-display italic font-normal text-[12px] text-cream/85 mt-0.5">
          Nothing is saved until you say so
        </span>
      </button>
    </div>
  )
}
