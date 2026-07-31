import FieldLabel from './FieldLabel'

// Who this recipe came from — folded into the TOP of the add form rather than
// standing as its own step.
//
// It used to be a full screen between the doorway and the form, which made the
// flow doorway → source → form → saved. Testers found the add flow too effortful
// and one abandoned mid-way, so the cheapest real win was removing a screen
// rather than shortening the fields on it: this is three optional inputs and a
// name, not a page's worth of work.
//
// Only shown on the inherited path. On the self-authored path there is no source
// to name — the person filling the form IS the source — and asking "who taught
// you this?" there was one of the specific things that made the app feel like it
// wasn't listening.
export default function SourceFields({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <div className="sticker bg-peach p-4">
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <h2 className="font-display font-black text-[19px] text-ink leading-none">
          Whose recipe is this?
        </h2>
      </div>
      <p className="font-display italic text-[12.5px] text-ink-soft mb-3">
        They&rsquo;ll be named on it as the person it came from.
      </p>

      <label className="block mb-2.5">
        <FieldLabel>Their name</FieldLabel>
        <input
          className="field"
          placeholder="e.g. Lola Remedios"
          value={value.name}
          onChange={set('name')}
        />
      </label>
      <div className="flex gap-2.5">
        <label className="block flex-1">
          <FieldLabel>Place (optional)</FieldLabel>
          <input
            className="field"
            placeholder="Cebu"
            value={value.place}
            onChange={set('place')}
          />
        </label>
        <label className="block flex-1">
          <FieldLabel>Year (optional)</FieldLabel>
          <input
            className="field"
            placeholder="1974"
            value={value.year}
            onChange={set('year')}
          />
        </label>
      </div>
    </div>
  )
}
