import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPost } from '../api/posts'
import { toUserMessage } from '../api/client'
import { createUploader, PHOTO_ACCEPT } from '../lib/photoUpload'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import FieldLabel from '../components/FieldLabel'

// "Share a meal" — the light everyday post. Photo (required, it IS the post) + dish
// name (required) + an optional line. NOT a recipe: no ingredients, no steps. Lands
// on the feed (Home). Reuses the same Cloudinary pick→convert→upload pipeline as the
// recipe cover, so HEIC handling and the race-safe uploader come for free.
export default function PostComposer() {
  const navigate = useNavigate()
  const [photoUrl, setPhotoUrl] = useState('')
  const [dishName, setDishName] = useState('')
  const [description, setDescription] = useState('')
  // Concrete visibility (#68). Auto-select mirrors the author's profile — "Everyone" on
  // a public profile, "Friends only" on a private one — but the value is stored literally.
  const profileVisibility =
    JSON.parse(localStorage.getItem('issei_user') || '{}').profile_visibility ||
    'private'
  const [visibility, setVisibility] = useState(
    profileVisibility === 'public' ? 'public' : 'friends',
  )
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const uploader = useRef(createUploader())

  function onPickPhoto(e) {
    return uploader.current.upload({
      slot: 'post',
      event: e,
      onBusy: setUploading,
      onError: setPhotoError,
      onUrl: setPhotoUrl,
    })
  }

  function removePhoto() {
    uploader.current.retire('post')
    setPhotoUrl('')
    setPhotoError('')
  }

  const ready = Boolean(photoUrl) && dishName.trim().length > 0 && !uploading

  async function share() {
    if (!ready || posting) return
    setPosting(true)
    setError('')
    try {
      const { data } = await createPost({
        photo_url: photoUrl,
        dish_name: dishName.trim(),
        description: description.trim() || null,
        visibility,
      })
      // Land on the feed, where the new post now sits at the top.
      navigate('/', { state: { justPosted: data.id } })
    } catch (err) {
      setError(toUserMessage(err, 'Couldn’t share that. Try again.'))
      setPosting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream px-[18px] pt-5 pb-10">
      <div className="mb-4">
        <BackButton to="/add" label="Back" />
      </div>
      <h1 className="font-display font-black text-[28px] text-ink leading-tight">
        Share a meal
      </h1>
      <p className="font-display italic text-[14px] text-ink-soft mt-2 mb-5">
        A photo and what it is. Your friends will see it.
      </p>

      {/* Photo — the post itself, so it's the first and largest field. */}
      {photoUrl ? (
        <div className="relative sticker overflow-hidden bg-card w-full h-[240px] mb-4">
          <img src={photoUrl} alt="Your meal" className="w-full h-full object-cover block" />
          <button
            type="button"
            onClick={removePhoto}
            aria-label="Remove photo"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink flex items-center justify-center shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label
          aria-busy={uploading || undefined}
          className={`relative sticker sticker-press flex flex-col items-center justify-center w-full h-[240px] mb-4 cursor-pointer focus-within:ring-4 focus-within:ring-terra/25 ${
            photoError ? 'bg-brick/20' : 'bg-peach'
          }`}
        >
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={onPickPhoto}
            aria-label="Add a photo of your meal"
            className="sr-only"
          />
          {uploading ? (
            <>
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-saffron border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] text-ink animate-bounce">
                <Icon name="camera" className="w-7 h-7" />
              </span>
              <span className="font-display font-black text-[16px] text-ink mt-3 leading-none">
                Uploading…
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-cream border-[2.5px] border-ink shadow-[0_3px_0_#2E3A24] text-ink -rotate-[6deg]">
                <Icon name="camera" className="w-7 h-7" />
              </span>
              <span className="font-display font-black text-[17px] text-ink mt-3 leading-none">
                Add a photo
              </span>
              <span className="font-display italic text-[12.5px] text-ink-soft mt-1.5">
                Snap what you made
              </span>
            </>
          )}
        </label>
      )}
      {photoError && (
        <p className="mb-4">
          <span className="error-pill">{photoError}</span>
        </p>
      )}

      <div className="block mb-3">
        <FieldLabel>
          <label htmlFor="post-dish">What is it?</label>
        </FieldLabel>
        <input
          id="post-dish"
          type="text"
          placeholder="e.g. Sunday adobo"
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          maxLength={120}
          className="field"
        />
      </div>

      <div className="block">
        <FieldLabel>
          <label htmlFor="post-note">Description (optional)</label>
        </FieldLabel>
        {/* Framed as a dish description, not a note-to-friends, so the same text carries
            over verbatim if this meal later becomes a recipe (recipe form's own field is
            "Description"). */}
        <textarea
          id="post-note"
          placeholder="A little about it — what's in it, how it tastes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={500}
          className="field resize-none"
        />
      </div>

      {/* Who sees it — three concrete choices (#68), each stored literally. Auto-selected
          from the author's profile, but any is pickable. Compact pill row — a post is a
          light act, not a form. */}
      <fieldset className="mt-5">
        <legend className="section-label mb-2">Who can see this?</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Who can see this post">
          {[
            { value: 'friends', label: 'Friends' },
            { value: 'public', label: 'Everyone' },
            { value: 'private', label: 'Only me' },
          ].map((opt) => {
            const selected = visibility === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setVisibility(opt.value)}
                className={`flex-1 rounded-full border-2 border-ink px-3 py-2 font-display font-bold text-[13px] transition-transform active:translate-y-[1px] ${
                  selected ? 'bg-peach text-ink' : 'bg-card text-ink-soft'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {error && (
        <p className="mt-4">
          <span className="error-pill">{error}</span>
        </p>
      )}

      <button
        onClick={share}
        disabled={!ready || posting}
        className="btn-primary mt-5 disabled:opacity-50"
      >
        {posting ? 'Sharing…' : 'Share it'}
      </button>
    </div>
  )
}
