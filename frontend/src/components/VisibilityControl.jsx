import { useState } from 'react'
import { setVisibility } from '../api/sharing'

// The owner-only visibility control on the recipe page: a status pill plus a
// publish / un-publish toggle.
//
// It used to have two more branches — a read-only "inherited from the original"
// state, and a confirm dialog warning that publishing would also publish the
// versions built on top of this one. Both existed because recipes were trees. They
// aren't, so the branches were unreachable and read `parent_recipe_id` /
// `child_count`, which RecipeResponse no longer returns.
//
// Copy is deliberately kept in step with VisibilityChoice, the create-time
// sibling: the two states carry its exact titles ("Only me" / "Everyone"), so the
// same recipe doesn't get described two ways in two places. The action says where
// the recipe lands instead of "Make public". The 🔒/🌐 emoji are gone — a padlock
// is a security promise ("private" here means "not listed in Browse", not
// encrypted), and the sticker pill already carries the visual weight.
//
// Two italic lines used to sit under the pill (what the current setting means,
// and what reverting does). Stacked above the handoff and delete copy, they made
// the bottom of the recipe page read as prose surrounding the buttons rather than
// as controls, so the reversibility line is gone and ONE line survives: the
// sentence naming what "Everyone" exposes. That one is not decoration — it is the
// only place in the app a user learns that public means "listed in Browse", and
// round-2 testers were specifically anxious about exactly that. It's set in small
// plain sans rather than the italic display face so it reads as the setting's
// definition, not as another paragraph.
export default function VisibilityControl({ recipe, onChange }) {
  const [visibility, setVis] = useState(recipe.visibility || 'private')
  const [busy, setBusy] = useState(false)

  const isPublic = visibility === 'public'
  const label = isPublic ? 'Everyone' : 'Only me'

  async function apply(next) {
    setBusy(true)
    try {
      const { data } = await setVisibility(recipe.id, next)
      setVis(data.visibility)
      onChange?.(data.visibility)
    } finally {
      setBusy(false)
    }
  }

  // No confirm step: the dialog this replaced existed only to warn that
  // publishing a recipe would also publish the versions built on top of it. There
  // are no versions — recipes aren't trees any more — so it could never open, and
  // it read `recipe.child_count`, which RecipeResponse no longer returns.
  function onToggle() {
    apply(isPublic ? 'private' : 'public')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The question first, then the answer as a pill — the same framing as the
          create-time choice, so this reads as "the setting you picked" rather
          than an unexplained status badge. */}
      <p className="section-label">Who can see this</p>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-block font-display font-bold text-[12px] text-ink bg-cream border-2 border-ink rounded-full px-3 py-1">
          {label}
        </span>
        {!isPublic && (recipe.shared_with_count || 0) > 0 && (
          <span className="font-display text-[12px] text-ink-soft">
            Shared with {recipe.shared_with_count}{' '}
            {recipe.shared_with_count === 1 ? 'person' : 'people'}
          </span>
        )}
        <button
          onClick={onToggle}
          disabled={busy}
          className="font-display font-bold text-[12.5px] text-terra disabled:opacity-50"
        >
          {isPublic ? 'Change to only me' : 'Change to everyone'}
        </button>
      </div>

      {/* The ONE line that survives the cut, because "Everyone" is the only label
          here a user can't decode from the word itself — it means "listed in a
          public directory", which is the thing testers were anxious about. The
          private state's old counterpart ("It stays in your kitchen…") was cut
          instead: "Only me" already says it. Plain small sans, not the italic
          display face, so it reads as a definition of the setting rather than
          another paragraph of page prose. */}
      <p className="font-sans text-[11.5px] leading-snug text-ink-soft">
        {isPublic
          ? 'It shows up in Browse, where anyone can find it and cook it.'
          : 'Everyone means it shows up in Browse, for anyone to find and cook.'}
      </p>
    </div>
  )
}
