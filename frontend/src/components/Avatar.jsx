// A person's avatar — their uploaded photo, or the first-letter monogram when there's
// none (#33). One component so the fallback is identical everywhere a person appears
// (You box, profile header, PostCard, friends list). A photo is identity, not private
// content, so it shows wherever the name shows regardless of profile visibility.
//
// `size` is a preset (the four places that use it), each a fixed px so the ink outline +
// offset shadow stay proportional. `bg` sets the monogram's fill so it can match its
// surroundings (peach in most rows, plum on the You identity card). Photos always crop
// to a circle via object-cover; the backend already squared them (400x400, face gravity).
const SIZES = {
  sm: 'w-9 h-9 text-[15px] shadow-[0_2px_0_#2E3A24]', // PostCard header, friends rows
  md: 'w-11 h-11 text-[17px] shadow-[0_2px_0_#2E3A24]', // (spare)
  lg: 'w-16 h-16 text-3xl shadow-[0_3px_0_#2E3A24]', // You identity card
  xl: 'w-20 h-20 text-[32px] shadow-[0_4px_0_#2E3A24]', // UserProfile header
}

export default function Avatar({ name, photoUrl, size = 'sm', bg = 'bg-peach', className = '' }) {
  const sizeClass = SIZES[size] || SIZES.sm
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const base = `flex-none flex items-center justify-center rounded-full border-2 border-ink overflow-hidden ${sizeClass} ${className}`

  if (photoUrl) {
    return (
      <span className={base}>
        <img
          src={photoUrl}
          alt={name || 'Profile photo'}
          className="w-full h-full object-cover block"
        />
      </span>
    )
  }
  return (
    <span className={`${base} ${bg} text-ink font-display font-black`}>{initial}</span>
  )
}
