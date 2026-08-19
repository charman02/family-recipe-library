import { useState } from 'react'
import { setVisibility } from '../api/sharing'

// The owner-only visibility control on the recipe page. THREE concrete states (#68):
// Everyone / Friends only / Only me — each stored literally. This is the edit-time
// sibling of VisibilityChoice (the create-time choice); the two carry the same titles
// so a recipe isn't described two ways in two places.
//
// It replaced a two-branch publish/un-publish toggle. Copy names the CONSEQUENCE (who
// ends up seeing it) rather than the app's jargon. No emoji padlock — "private" here
// means "not listed publicly", not encrypted, and a lock overstates it.
export default function VisibilityControl({ recipe, onChange }) {
  const [visibility, setVis] = useState(recipe.visibility || 'friends')
  const [busy, setBusy] = useState(false)

  const OPTIONS = [
    {
      value: 'public',
      title: 'Everyone',
      detail: 'It shows up in Browse, where anyone can find it and cook it.',
    },
    {
      value: 'friends',
      title: 'Friends only',
      detail: 'Only the people you’re friends with on issei can see it.',
    },
    {
      value: 'private',
      title: 'Only me',
      detail: 'It stays in your kitchen. You can still send it to someone directly.',
    },
  ]

  async function pick(next) {
    if (next === visibility || busy) return
    setBusy(true)
    // Optimistic: reflect the choice immediately, roll back if the PATCH fails.
    const prev = visibility
    setVis(next)
    try {
      const { data } = await setVisibility(recipe.id, next)
      setVis(data.visibility)
      onChange?.(data.visibility)
    } catch {
      setVis(prev)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="section-label">Who can see this</p>
      <div className="space-y-2" role="radiogroup" aria-label="Who can see this recipe">
        {OPTIONS.map((opt) => {
          const selected = visibility === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => pick(opt.value)}
              className={`flex w-full items-start gap-3 text-left sticker-sm p-3 disabled:opacity-60 ${
                selected ? 'bg-peach' : 'bg-card'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex-none flex items-center justify-center w-[19px] h-[19px] mt-0.5 rounded-full border-2 border-ink bg-cream"
              >
                {selected && (
                  <span className="block w-[9px] h-[9px] rounded-full bg-terra" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-display font-black text-[15px] text-ink leading-none">
                  {opt.title}
                </span>
                <span className="block font-display text-[12.5px] text-ink-soft mt-1">
                  {opt.detail}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {(recipe.shared_with_count || 0) > 0 && (
        <p className="font-display text-[12px] text-ink-soft">
          Shared with {recipe.shared_with_count}{' '}
          {recipe.shared_with_count === 1 ? 'person' : 'people'}
        </p>
      )}
    </div>
  )
}
