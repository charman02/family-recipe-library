// One recipe shown as its living plant, at a stage-specific height (seed short →
// tree tall) so a garden bed reads as real varied growth. Silhouettes/colors
// reuse the live R2 plant (copied from .superpowers/garden-liveliness-mockup.html).
// Ambient sway from the base; disabled under reduced motion. See garden-liveliness spec.

// Per-stage rendered size + viewBox. Heights MUST step up seed < sprout <
// sapling < tree. The sprout's art is drawn in a larger 64×84 coordinate space
// but rendered at 50×66, so the browser scales it down (nothing clips); every
// other stage's viewBox equals its w×h.
const DIMS = {
  seed: { w: 60, h: 52, vb: '0 0 60 52' },
  sprout: { w: 50, h: 66, vb: '0 0 64 84' },
  sapling: { w: 96, h: 120, vb: '0 0 96 120' },
  tree: { w: 120, h: 150, vb: '0 0 120 150' },
}

function Defs() {
  return (
    <defs>
      <linearGradient id="soilG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5B4632" />
        <stop offset="1" stopColor="#3E301F" />
      </linearGradient>
      <linearGradient id="stemG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7FA05A" />
        <stop offset="1" stopColor="#557038" />
      </linearGradient>
      <linearGradient id="leafG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8DAD66" />
        <stop offset="1" stopColor="#5C7A3F" />
      </linearGradient>
      <linearGradient id="trunkG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8A6A45" />
        <stop offset="45%" stopColor="#6E5236" />
        <stop offset="100%" stopColor="#513A24" />
      </linearGradient>
      <radialGradient id="canDeep" cx="42%" cy="34%" r="72%">
        <stop offset="0" stopColor="#4E6A34" />
        <stop offset="100%" stopColor="#3B5228" />
      </radialGradient>
      <radialGradient id="canMid" cx="40%" cy="30%" r="74%">
        <stop offset="0" stopColor="#6B8C48" />
        <stop offset="100%" stopColor="#557038" />
      </radialGradient>
      <radialGradient id="canBright" cx="36%" cy="26%" r="78%">
        <stop offset="0" stopColor="#8DAD66" />
        <stop offset="100%" stopColor="#6F9150" />
      </radialGradient>
      <radialGradient id="fruitG" cx="34%" cy="30%" r="82%">
        <stop offset="0" stopColor="#F4BC64" />
        <stop offset="52%" stopColor="#E8973A" />
        <stop offset="100%" stopColor="#C46E1C" />
      </radialGradient>
    </defs>
  )
}

// SVG body per stage (paths copied verbatim from the approved mockup).
const BODY = {
  seed: (
    <>
      <ellipse cx="30" cy="44" rx="11" ry="7" fill="url(#soilG)" />
      <ellipse cx="30" cy="40" rx="7" ry="5" fill="#8b6b47" />
      <path
        d="M30 37 q1 -6 3 -9"
        stroke="#6F9150"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 29 q3 -1 5 -3"
        stroke="#7FA05A"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  sprout: (
    <>
      <path
        d="M31 78 C32 60 31 46 33 34 L35 34 C37 46 34 60 35 78 Z"
        fill="url(#stemG)"
      />
      <path
        d="M32 46 C20 42 12 34 12 24 C22 26 31 34 34 44 Z"
        fill="url(#leafG)"
      />
      <path
        d="M34 40 C46 34 54 26 55 16 C45 18 35 28 32 38 Z"
        fill="url(#leafG)"
      />
    </>
  ),
  sapling: (
    <>
      <path
        d="M46 114 C43 96 43 74 46 54 C47 74 49 96 49 114 Z"
        fill="url(#trunkG)"
      />
      <path
        d="M46 72 C37 66 30 60 25 52 C33 60 41 66 47 74 Z"
        fill="url(#trunkG)"
      />
      <path
        d="M48 66 C57 60 64 54 69 46 C61 54 53 60 46 68 Z"
        fill="url(#trunkG)"
      />
      <ellipse cx="47" cy="40" rx="30" ry="26" fill="url(#canDeep)" />
      <ellipse cx="30" cy="50" rx="15" ry="13" fill="url(#canMid)" />
      <ellipse cx="64" cy="50" rx="15" ry="13" fill="url(#canMid)" />
      <ellipse cx="40" cy="30" rx="17" ry="14" fill="url(#canBright)" />
      <ellipse cx="57" cy="34" rx="14" ry="12" fill="url(#canBright)" />
    </>
  ),
  tree: (
    <>
      <path
        d="M58 144 C53 120 52 96 56 70 C57 84 59 108 62 144 Z"
        fill="url(#trunkG)"
      />
      <path
        d="M57 74 C45 66 35 58 27 48 C37 58 48 66 58 78 Z"
        fill="url(#trunkG)"
      />
      <path
        d="M60 82 C72 74 84 66 92 56 C82 68 70 76 59 84 Z"
        fill="url(#trunkG)"
      />
      <ellipse cx="59" cy="46" rx="46" ry="38" fill="url(#canDeep)" />
      <ellipse cx="26" cy="60" rx="22" ry="19" fill="url(#canDeep)" />
      <ellipse cx="92" cy="60" rx="22" ry="19" fill="url(#canDeep)" />
      <ellipse cx="59" cy="42" rx="40" ry="33" fill="url(#canMid)" />
      <ellipse cx="38" cy="30" rx="22" ry="18" fill="url(#canBright)" />
      <ellipse cx="76" cy="34" rx="19" ry="16" fill="url(#canBright)" />
      <ellipse cx="59" cy="46" rx="22" ry="17" fill="url(#canBright)" />
      <circle cx="40" cy="34" r="3.4" fill="#FBF7EE" />
      <circle cx="40" cy="34" r="1.4" fill="#D99A2B" />
      <circle cx="82" cy="52" r="4" fill="url(#fruitG)" />
      <circle cx="66" cy="66" r="4" fill="url(#fruitG)" />
    </>
  ),
}

export default function GardenPlant({ stage, vitality, reduceMotion = false }) {
  const s = DIMS[stage] ? stage : 'seed'
  const { w, h, vb } = DIMS[s]
  return (
    <svg
      className={'garden-plant' + (reduceMotion ? '' : ' garden-sway')}
      data-stage={s}
      width={w}
      height={h}
      viewBox={vb}
      role="img"
      aria-hidden="true"
    >
      <Defs />
      {BODY[s]}
    </svg>
  )
}
