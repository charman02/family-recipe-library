import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'

// Bottom nav — a floating "sticker" pill in the reference's flat-graphic language:
// a cream capsule with a bold ink outline and a solid offset shadow (the sticker
// look), inactive tabs are icon-only, the ACTIVE tab morphs into a terra
// color-blob that reveals its Fraunces label, and Add is a raised SCALLOPED
// badge (the reference's signature petal shape) rising above the pill.
// Vocabulary: Home · Browse · Add · Kitchen · You.

const INK = '#2E3A24'

// Build a scalloped-badge outline (a bumpy "flower" circle) as one SVG path, so
// the border stays clean (only the outer petals, no internal seams). Each bump
// is a semicircular arc between equally-spaced points on a circle of radius R.
function scallopPath(cx, cy, R, bumps) {
  const rBump = R * Math.sin(Math.PI / bumps)
  const pt = (k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / bumps
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
  }
  const [x0, y0] = pt(0)
  let d = `M${x0.toFixed(2)},${y0.toFixed(2)}`
  for (let k = 1; k <= bumps; k++) {
    const [x, y] = pt(k)
    d += `A${rBump.toFixed(2)},${rBump.toFixed(2)} 0 0 1 ${x.toFixed(2)},${y.toFixed(2)}`
  }
  return d + 'Z'
}
const SCALLOP = scallopPath(50, 50, 38, 11)

const navItems = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Browse', path: '/browse', icon: 'search' },
  { label: 'Add', path: '/add', icon: 'plus', center: true },
  { label: 'Kitchen', path: '/my-recipes', icon: 'pot' },
  { label: 'You', path: '/profile', icon: 'user' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    // Full-width layer that lets content scroll behind; only the pill + badge
    // catch taps (pointer-events re-enabled on them).
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
      <nav className="pointer-events-auto relative flex items-center gap-1 rounded-full border-[2.5px] border-ink bg-cream px-2.5 py-2 shadow-[0_4px_0_#2E3A24]">
        {navItems.map((item) => {
          const active = location.pathname === item.path

          // ADD — a raised scalloped badge that breaks above the pill.
          if (item.center) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                className="relative mx-0.5 -mt-8 h-14 w-14 active:translate-y-[2px] transition-transform"
              >
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 h-full w-full drop-shadow-[0_3px_0_#2E3A24]"
                  aria-hidden="true"
                >
                  <path d={SCALLOP} fill="#B5502A" stroke={INK} strokeWidth="4" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-cream">
                  <Icon name="plus" className="h-6 w-6" strokeWidth={2.6} />
                </span>
              </button>
            )
          }

          // ACTIVE tab → terra color-blob with the Fraunces label; inactive →
          // icon-only, quiet ink-soft.
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center rounded-full transition-all duration-200 ${
                active
                  ? 'gap-1.5 bg-terra px-3.5 py-2 text-cream'
                  : 'px-2 py-2 text-ink-soft'
              }`}
            >
              <Icon
                name={item.icon}
                className="h-[22px] w-[22px]"
                strokeWidth={active ? 2 : 1.8}
              />
              {active && (
                <span className="font-display font-bold text-[14px] leading-none pr-0.5">
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
