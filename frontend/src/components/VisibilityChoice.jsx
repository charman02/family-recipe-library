// The create-time visibility choice, folded into the bottom of the add-recipe
// form (PlantRecipe passes it as RecipeForm's beforeSubmitSlot). Its edit-time
// sibling is VisibilityControl, which toggles an already-saved recipe.
//
// THREE CONCRETE choices (issei #68) — each stored literally, so the label never lies:
// "Friends only" means friends only, permanently, whatever your profile later becomes.
// The parent auto-selects the default from the caller's profile ("Everyone" on a public
// profile, "Friends only" on a private one), but the user can pick any of the three.
//
// Copy avoids the app's own vocabulary ("pass it on", "issei") that round-2 user testing
// showed people couldn't decode, and names the consequence instead.
export default function VisibilityChoice({ value, onChange }) {
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
      detail:
        'It stays in your kitchen. You can still send it to someone directly.',
    },
  ]

  return (
    <fieldset className="mt-7">
      <legend className="font-display font-black text-[19px] text-ink mb-2.5">
        Who can see this?
      </legend>
      <div className="space-y-2.5">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 cursor-pointer sticker-sm p-3 focus-within:ring-4 focus-within:ring-terra/25 ${
                selected ? 'bg-peach' : 'bg-card'
              }`}
            >
              {/* sr-only rather than `hidden`: display:none drops the radio out
                  of the tab order, and focus-within rings the card instead. */}
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
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
            </label>
          )
        })}
      </div>
      <p className="font-display italic text-[12px] text-ink-soft mt-2">
        You can change this any time.
      </p>
    </fieldset>
  )
}
