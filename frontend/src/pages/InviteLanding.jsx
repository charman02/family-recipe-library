import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInvitePreview } from '../api/lineage'
import CoverImage from '../components/CoverImage'
import Loader from '../components/Loader'

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
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="error-pill">{error}</span>
        <Link
          to="/login"
          className="inline-block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
        >
          Go to issei
        </Link>
      </div>
    )
  }
  if (!preview) {
    return <Loader label="Opening…" />
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
        <p className="text-[14px] mt-1">
          <span className="font-display italic text-ink-soft">from </span>
          <span className="font-display font-bold italic text-plum">
            {preview.origin_attribution.split('·')[0].trim()}
          </span>
        </p>
      )}
      {preview.story && (
        <p className="font-hand text-[22px] text-ink mt-5 max-w-sm leading-snug">
          {preview.story}
        </p>
      )}
      <div className="mt-8 w-full max-w-sm">
        <Link
          to={`/login?tab=signup&invite=${token}`}
          className="block rounded-full bg-terra px-7 py-3 font-display font-bold text-[15px] text-cream border-[2.5px] border-ink shadow-[0_4px_0_#2E3A24] active:translate-y-[3px] active:shadow-[0_1px_0_#2E3A24] transition-transform"
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
