import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInvitePreview } from '../api/lineage'
import CoverImage from '../components/CoverImage'

// The soft-wall recipient landing (spec §4.3): a warm preview — name, who it's
// from, the story, the dish's photo — then a signup gate to participate. The
// emotional hook lands BEFORE the ask. Public route; no account required to view.
export default function InviteLanding() {
  const { token } = useParams()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    getInvitePreview(token)
      .then(({ data }) => {
        if (live) setPreview(data)
      })
      .catch(() => {
        if (live) setError('This invite link is not valid or has expired.')
      })
    return () => {
      live = false
    }
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display italic text-ink-soft">{error}</p>
        <Link
          to="/login"
          className="mt-5 inline-block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream shadow-[0_6px_0_#7c351a] active:translate-y-[3px] active:shadow-[0_3px_0_#7c351a] transition"
        >
          Go to issei
        </Link>
      </div>
    )
  }
  if (!preview) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-display italic text-ink-soft">Opening…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center px-6 py-12 text-center">
      <h1 className="font-display font-black text-[30px] leading-none text-ink mb-6">
        issei<span className="text-terra">.</span>
      </h1>

      <div className="sticker overflow-hidden w-[230px] h-[156px]">
        <CoverImage
          url={preview.cover_photo_url}
          size="md"
          className="w-full h-full object-cover"
        />
      </div>

      {preview.from_name && (
        <p className="font-display font-bold uppercase tracking-[0.18em] text-[11px] text-terra mt-5 mb-1">
          {preview.from_name} passed you
        </p>
      )}
      <h2 className="font-display font-black text-[28px] text-ink leading-tight">
        {preview.name}
      </h2>
      {preview.origin_attribution && (
        <p className="font-display italic text-[14px] text-plum mt-1">
          from {preview.origin_attribution.split('·')[0].trim()}
        </p>
      )}
      {preview.story && (
        <p className="font-hand text-[21px] text-plum mt-5 max-w-sm leading-snug">
          {preview.story}
        </p>
      )}
      <div className="mt-8 w-full max-w-sm">
        <Link
          to={`/login?tab=signup&invite=${token}`}
          className="block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream shadow-[0_6px_0_#7c351a] active:translate-y-[3px] active:shadow-[0_3px_0_#7c351a] transition"
        >
          Keep this recipe →
        </Link>
        <p className="font-display text-[13px] text-ink-soft mt-3">
          Make a free account to cook it, keep it, and add the parts only you
          know.
        </p>
      </div>
    </div>
  )
}
