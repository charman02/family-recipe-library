// The issei. logo.
//
// THE PROBLEM IT SOLVES: the mark used to be bare Fraunces black in ink with a terra
// period — which is exactly what every heading in this app is. On Home that put the
// logo and the hero heading in the same font, weight and colour ~40px apart, so the
// two competed and the logo lost: it read as the first of two headings rather than as
// the brand. Scale alone couldn't fix that; a bigger version is still the same
// material. It had to become a different KIND of thing.
//
// CHOSEN from nine treatments compared side by side on the real page: this one, a
// cream-on-ink plate, plus a cream plate, a stamped seal, a terra plate, an underlined
// wordmark, and four that worked a tree into the mark for the family-tree association.
// It wins on the same argument that made it the first candidate — an ink field with
// cream type is the ONLY inverted element in an app where everything else is dark type
// on a light field, so nothing else on any screen can accidentally look like it. It
// also earns the sticker language the rest of the design uses (ink outline, hard
// offset shadow) instead of opting out of it.
//
// The period stays terra: it's the most recognisable detail in the mark, and on an ink
// field it goes from a small dark dot to a lit one.
//
// The tree options are deleted rather than kept behind a flag. Worth recording why
// they existed and why they're gone: a tree reads as a FAMILY TREE, and this app
// removed lineage entirely (8a3b734 — no ancestors, descendants, roots or branches)
// after an earlier garden UI rendered recipes as plants growing seed→sprout→tree,
// which testers found confusing. A logo isn't a feature claim, so a tree was
// defensible — but it points at something the product deliberately doesn't do.
//
// `size`: 'sm' (page headers) · 'lg' (login — where the mark IS the screen).

const SIZES = {
  sm: 'text-[26px] px-3.5 py-1.5 rounded-[14px] shadow-[0_3px_0_#2E3A24]',
  lg: 'text-[44px] px-6 py-2.5 rounded-[20px] shadow-[0_5px_0_#2E3A24]',
}

// `bare` drops the ink plate and renders the type alone in ink.
//
// For use ON an existing colour field — a photo-less recipe cover. The plate is what
// makes the mark unmistakable in a page header, but inside another rounded, outlined
// box it reads as a box in a box, and the cover frame already supplies the shape and
// the colour. The terra period survives, which is the part people actually recognise.
export default function Wordmark({ size = 'sm', bare = false, className = '' }) {
  const type = (
    <span
      className={`font-display font-black leading-none tracking-[-0.01em] ${
        bare ? 'text-ink' : 'text-cream'
      }`}
    >
      issei<span className="text-terra">.</span>
    </span>
  )

  if (bare) {
    return <span className={`inline-block ${SIZES[size].split(' ')[0]} ${className}`}>{type}</span>
  }

  return (
    <span
      className={`inline-block bg-ink border-[2.5px] border-ink ${SIZES[size]} ${className}`}
    >
      {type}
    </span>
  )
}
