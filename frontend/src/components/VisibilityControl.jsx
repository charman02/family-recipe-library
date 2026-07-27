import { useState } from 'react'
import { setVisibility } from '../api/lineage'

// Placement-C visibility control (spec §3). Owner-only surface on the recipe page.
// Root: status pill + publish/un-publish toggle (descendants-aware confirm).
// Branch: read-only inherited status.
export default function VisibilityControl({ recipe, onChange }) {
  const isRoot = recipe.parent_recipe_id == null
  const [visibility, setVis] = useState(recipe.visibility || 'private')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const isPublic = visibility === 'public'
  const label = isPublic ? '🌐 Public' : '🔒 Private'

  if (!isRoot) {
    return (
      <p className="font-sans text-[11px] text-ink-soft">
        {label} — inherited from the original
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
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-block font-display font-bold text-[12px] text-ink bg-cream border-2 border-ink rounded-full px-3 py-1">
          {label}
        </span>
        {!isPublic && (recipe.shared_with_count || 0) > 0 && (
          <span className="font-display text-[12px] text-ink-soft">
            Shared with {recipe.shared_with_count}
          </span>
        )}
        <button
          onClick={onToggle}
          disabled={busy}
          className="font-display font-bold text-[12.5px] text-terra disabled:opacity-50"
        >
          {isPublic ? 'Make private' : 'Make public'}
        </button>
      </div>

      {isPublic && (
        <p className="font-display italic text-[12px] text-ink-soft">
          Making it private removes it from Browse, but versions already kept
          stay with their owners.
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-6">
          <div className="sticker bg-cream p-5 max-w-xs w-full">
            <p className="font-display font-black text-ink text-[18px] mb-1">
              Make this public?
            </p>
            <p className="font-display text-[13px] text-ink-soft mb-4">
              This also makes the {recipe.child_count} version
              {recipe.child_count === 1 ? '' : 's'} built on it public. Anyone
              will be able to find and keep it.
            </p>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => apply('public')}
                disabled={busy}
                className="btn-primary !w-auto px-5"
              >
                Publish
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
