// Decorative emoji discs scattered inside the Home hero box. Positions are px
// offsets from the box's top-left corner (x/y), set via the drag editor that
// used to live here (removed now that placement is locked). To re-tweak, adjust
// the numbers below — the page hot-reloads.

const BG = {
  cream: 'bg-cream',
  saffron: 'bg-saffron',
  coral: 'bg-coral',
  mint: 'bg-mint',
  peach: 'bg-peach',
  periwinkle: 'bg-periwinkle',
  plum: 'bg-plum',
}

const DISCS = [
  { emoji: '🍜', bg: 'coral', x: 296, y: 39, size: 64, tilt: 8, fontSize: 30 },
  { emoji: '🥘', bg: 'saffron', x: 276, y: 176, size: 56, tilt: -6, fontSize: 26 },
  { emoji: '🥟', bg: 'mint', x: 221, y: 105, size: 48, tilt: 6, fontSize: 22 },
]

export default function HeroDiscs() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {DISCS.map((d, i) => (
        <span
          key={i}
          style={{
            left: `${d.x}px`,
            top: `${d.y}px`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            transform: `rotate(${d.tilt}deg)`,
          }}
          className={`absolute flex items-center justify-center rounded-full border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] ${BG[d.bg] || 'bg-cream'}`}
        >
          <span style={{ fontSize: `${d.fontSize}px` }} className="leading-none select-none">
            {d.emoji}
          </span>
        </span>
      ))}
    </div>
  )
}
