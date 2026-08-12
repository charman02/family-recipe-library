import { useEffect, useState } from 'react'
import RecipeCard from './RecipeCard'
import { prefersReducedMotion } from '../lib/prefs'

// The "keep this recipe" moment — a friend's idea, and it fits the app's cute
// sticker aesthetic. A cooking timer fast-forwards to zero, poofs into a big white
// steam cloud, and once the cloud has fully cleared the finished recipe springs
// in: a green checkmark, "Saved to your kitchen", the real recipe card, and a
// share button. The reveal is the TERMINAL screen (it replaces the old separate
// "saved" step) — the user either taps the card to view the recipe (onView) or the
// button to send it (onShare). Nothing auto-advances.
//
// It is DECORATION over a save that already succeeded — PlantRecipe calls
// plantRecipe first, then renders this — so it is never load-bearing. Reduced
// motion (the in-app toggle or the OS setting) renders the reveal on the first
// frame with no animation, so the same actions are always one tap away.
//
// STRICTLY SEQUENTIAL phases: 'timer' (dial sweeps) → 'poof' (steam cloud plays
// alone, nothing behind it) → 'reveal' (card + actions spring in, and stay). The
// card is never mounted under the cloud, so it can't peek through the gaps.
// POOF_MS must cover the full puff-poof keyframe PLUS the longest puff delay.
const TIMER_MS = 950
const POOF_MS = 1550

// A tight cauliflower mound of overlapping lobes — the bumpy top/sides of a steam
// puff. Densely packed and near-solid so the OUTLINE reads as a cottony cloud, not
// a haze. x/y are the lobe center (% of the field), s its size (px), dx/dy the
// drift as it disperses, d the stagger delay.
// Delays (`d`) are kept in a TIGHT 0–60ms band on purpose: a wide stagger made the
// cloud look like it grew in stages (core, then crown, then sides…). A near-common
// start makes every lobe billow out together as one continuous poof, with just
// enough offset (a few ms, roughly center → edge) to keep it from pulsing as a
// single rigid blob.
const PUFFS = [
  // core mass
  { x: 50, y: 52, s: 190, dx: 0, dy: -20, d: 0 },
  { x: 40, y: 52, s: 150, dx: -60, dy: 0, d: 10 },
  { x: 60, y: 52, s: 150, dx: 60, dy: 0, d: 10 },
  // bumpy crown
  { x: 38, y: 38, s: 120, dx: -55, dy: -70, d: 40 },
  { x: 50, y: 34, s: 132, dx: 0, dy: -90, d: 45 },
  { x: 62, y: 38, s: 120, dx: 55, dy: -70, d: 40 },
  { x: 30, y: 44, s: 104, dx: -95, dy: -35, d: 55 },
  { x: 70, y: 44, s: 104, dx: 95, dy: -35, d: 55 },
  // shoulders / sides
  { x: 24, y: 54, s: 112, dx: -110, dy: 0, d: 60 },
  { x: 76, y: 54, s: 112, dx: 110, dy: 0, d: 60 },
  // rounded base bumps
  { x: 36, y: 64, s: 116, dx: -55, dy: 70, d: 50 },
  { x: 50, y: 66, s: 128, dx: 0, dy: 90, d: 45 },
  { x: 64, y: 64, s: 116, dx: 55, dy: 70, d: 50 },
  // small fill lobes to smooth the perimeter
  { x: 44, y: 46, s: 96, dx: -25, dy: -30, d: 20 },
  { x: 56, y: 46, s: 96, dx: 25, dy: -30, d: 20 },
  { x: 50, y: 58, s: 110, dx: 0, dy: 40, d: 15 },
]

// A single lobe. Near-solid white almost to its edge, then a short falloff — that
// hard-ish plateau is what makes overlapping lobes fuse into one opaque cottony
// mass with a bumpy silhouette (a steam puff), instead of the see-through vignette
// that read as mist. A LIGHT blur only softens the seams; it doesn't dissolve them.
const PUFF_BG =
  'radial-gradient(circle at 50% 45%, #ffffff 0%, #ffffff 66%, rgba(255,255,255,0.72) 82%, rgba(255,253,247,0) 100%)'

// The full steam cloud — a mound of lobes that fuse into one cottony puff and play
// the single `puff-poof` beat (billow in, hold, disperse). Rendered on its own with
// nothing behind it, so nothing can peek through.
function Cloud() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-visible">
      {PUFFS.map((p, i) => (
        <span
          key={i}
          className="animate-puff-poof"
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.s}px`,
            height: `${p.s}px`,
            background: PUFF_BG,
            // Light, not heavy: enough to melt the seams between lobes into one
            // cottony volume while keeping the puff opaque and its edge defined.
            filter: 'blur(6px)',
            borderRadius: '9999px',
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animationDelay: `${p.d}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default function SaveCelebration({ recipe, onView, onShare }) {
  const reduced = prefersReducedMotion()
  // Reduced motion jumps straight to the reveal — same terminal screen, no motion.
  const [phase, setPhase] = useState(reduced ? 'reveal' : 'timer')

  useEffect(() => {
    if (reduced) return
    const timers = []
    // Strictly sequential: timer → poof (plays alone, nothing behind it) → reveal
    // (card springs in only after the poof has fully cleared, so it never peeks
    // through the cloud). The poof hold accounts for the longest puff delay.
    timers.push(setTimeout(() => setPhase('poof'), TIMER_MS))
    timers.push(setTimeout(() => setPhase('reveal'), TIMER_MS + POOF_MS))
    return () => timers.forEach(clearTimeout)
    // Run the sequence once; recipe/callbacks are stable for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showReveal = phase === 'reveal'

  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* TIMER — a sticker dial with a sweeping hand. */}
      {phase === 'timer' && (
        <div className="relative flex items-center justify-center w-40 h-40">
          <div className="relative w-28 h-28 rounded-full bg-card border-[3px] border-ink shadow-[0_4px_0_#2E3A24] flex items-center justify-center">
            <span className="absolute -top-2 w-6 h-3 rounded-t-full bg-terra border-2 border-ink" />
            {[0, 90, 180, 270].map((deg) => (
              <span
                key={deg}
                aria-hidden="true"
                className="absolute w-1 h-3 bg-ink/70 rounded-full"
                style={{
                  transform: `rotate(${deg}deg) translateY(-46px)`,
                  transformOrigin: 'center',
                }}
              />
            ))}
            <span className="absolute bottom-1/2 w-[3px] h-11 bg-terra rounded-full animate-timer-sweep" />
            <span className="absolute w-3 h-3 rounded-full bg-ink" />
          </div>
        </div>
      )}

      {/* POOF — the steam cloud, alone. Bigger than the card but capped to the
          phone width (min of 26rem and the viewport) so it never runs off-screen.
          Nothing renders behind it during this phase, so nothing peeks through. */}
      {phase === 'poof' && (
        <div
          className="relative"
          style={{ width: 'min(26rem, 92vw)', height: 'min(26rem, 92vw)' }}
        >
          <Cloud />
        </div>
      )}

      {/* REVEAL — the terminal saved screen, shown only AFTER the poof has cleared. */}
      {showReveal && (
        <div className="w-full max-w-[280px] flex flex-col items-center text-center">
          {/* green check badge — same sage sticker circle the app uses for done */}
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sage text-ink border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] animate-card-pop-in">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-7 h-7">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#2E3A24"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="font-display font-black italic text-[22px] text-ink mt-3 mb-4 animate-card-pop-in">
            Saved to your kitchen
          </p>

          {/* the real card — tapping it opens the recipe */}
          <div className="w-[210px] animate-card-pop-in">
            <RecipeCard recipe={recipe} onClick={onView} variant="row" />
          </div>
          <p className="font-display italic text-[12.5px] text-ink-soft mt-2 mb-4 animate-card-pop-in">
            Tap it to see the whole thing.
          </p>

          {/* share — the other thing to do with a fresh recipe */}
          <button
            onClick={onShare}
            className="btn-primary animate-card-pop-in"
          >
            Send it to someone →
          </button>
        </div>
      )}
    </div>
  )
}
