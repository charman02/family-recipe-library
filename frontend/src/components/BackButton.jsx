import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

// An icon-only sticker back button for sub-pages reached from the 5 main tabs.
// Defaults to browser-history back; pass `to` to force a specific destination,
// or `onClick` for custom in-page navigation (e.g. stepping back through a
// multi-step flow). `label` is the accessible name only — the button shows just
// the arrow in a pill.
export default function BackButton({ to, onClick, label = 'Back', className = '' }) {
  const navigate = useNavigate()
  const handleClick = onClick ? onClick : () => (to ? navigate(to) : navigate(-1))

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-ink bg-cream text-ink shadow-[0_3px_0_#2E3A24] transition-transform active:translate-y-[2px] active:shadow-[0_1px_0_#2E3A24] ${className}`}
    >
      <Icon name="back" className="w-5 h-5" />
    </button>
  )
}
