import { useState } from 'react'
import { setVisibility } from '../api/sharing'

// Placement-C visibility control (spec §3). Owner-only surface on the recipe page.
// Root: status pill + publish/un-publish toggle (descendants-aware confirm).
// Branch: read-only inherited status.
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
  const isRoot = recipe.parent_recipe_id == null
  const [visibility, setVis] = useState(recipe.visibility || 'private')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const isPublic = visibility === 'public'
  const label = isPublic ? 'Everyone' : 'Only me'

  if (!isRoot) {
    return (
      <p className="font-sans text-[11px] text-ink-soft">
        Who can see this: {label.toLowerCase()} — it follows the recipe this one
        came from
      </p>
    )
  }

  async function apply(next) {
    setBusy(true)
    try {
      const { data } = await setVisibility(recipe.id, next)
      setVis(data.visibility)
      setConfirming(false)
      onChange?.(data.visibility)
    } finally {
      setBusy(false)
    }
  }

  function onToggle() {
    if (!isPublic && (recipe.child_count || 0) > 0) {
      setConfirming(true) // publishing a root with descendants → confirm the ripple
      return
    }
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

      {confirming && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-6">
          <div className="sticker bg-cream p-5 max-w-xs w-full">
            <p className="font-display font-black text-ink text-[18px] mb-1">
              Let everyone see this?
            </p>
            <p className="font-display text-[13px] text-ink-soft mb-4">
              It shows up in Browse, where anyone can find it and cook it — along
              with the {recipe.child_count} version
              {recipe.child_count === 1 ? '' : 's'} other people have built on
              it.
            </p>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => apply('public')}
                disabled={busy}
                className="btn-primary !w-auto px-5"
              >
                Yes, show it
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-5 py-3 font-display font-bold text-ink-soft text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
