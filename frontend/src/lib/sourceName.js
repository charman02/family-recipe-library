// The recorded source's name = the leading segment of origin_attribution
// (stored "Name · Place · Year").
export function sourceNameOf(recipe) {
  const attr = recipe?.origin_attribution
  if (!attr) return null
  const name = attr.split('·')[0].trim()
  return name || null
}

// The full stored attribution, split back into its parts. The form only shows a
// name field, but place/year may have been set through the older multi-field door
// (or the API), so an edit has to CARRY them through — rebuilding the byline from
// the name alone would silently drop "· Manila · 1985". Returns
// { name, place, year } with '' for any missing segment.
export function originPartsOf(recipe) {
  const attr = recipe?.origin_attribution
  if (!attr) return { name: '', place: '', year: '' }
  const [name = '', place = '', year = ''] = attr.split('·').map((s) => s.trim())
  return { name, place, year }
}
