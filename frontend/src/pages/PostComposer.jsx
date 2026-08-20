import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPost } from '../api/posts'
import { toUserMessage } from '../api/client'
import { createUploader, PHOTO_ACCEPT } from '../lib/photoUpload'
import { sourceNameOf } from '../lib/sourceName'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import FieldLabel from '../components/FieldLabel'
import RecipePicker from '../components/RecipePicker'

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
  // Optionally link one of your OWN recipes (#72). We keep the whole recipe object for the
  // chip's label/byline; only its id is sent. Ownership is the backend's call — create_post
  // 404s a recipe_id that isn't the caller's — so this is a convenience link, not a grant.
  const [recipe, setRecipe] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  function attachRecipe(r) {
    setRecipe(r)
    setPickerOpen(false)
    // Prefill the dish name from the recipe ONLY if the field is still empty — never
    // clobber something the author already typed. Recipe names are uncapped but a post's
    // dish_name is bounded at 120 (PostCreate.DishName), so clamp the programmatic fill to
    // match the input's maxLength — otherwise a long recipe name would sail past the field
    // cap and 422 on submit.
    if (!dishName.trim()) setDishName(r.name.slice(0, 120))
  }

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
        recipe_id: recipe ? recipe.id : null,
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

      {/* Attach a recipe (#72) — optional link to one of YOUR recipes, so a friend who
          sees the meal can open the actual recipe. Closed state: a dashed "add" button.
          Attached: a chip showing the recipe (cover/pot + name) with a remove ×. The
          post is still a light meal post; this is a pointer, not the recipe itself. */}
      <div className="mt-5">
        <span className="section-label">Attach a recipe (optional)</span>
        {recipe ? (
          <div className="mt-2 flex items-center gap-3 rounded-[14px] border-2 border-ink bg-card p-2 shadow-[0_2px_0_#2E3A24]">
            {recipe.cover_photo_url ? (
              <img
                src={recipe.cover_photo_url}
                alt=""
                className="flex-none w-10 h-10 rounded-[10px] border-2 border-ink object-cover"
              />
            ) : (
              <span className="flex-none flex items-center justify-center w-10 h-10 rounded-[10px] border-2 border-ink bg-peach text-ink">
                <Icon name="pot" className="w-5 h-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-display font-bold text-[14px] text-ink truncate">
                {recipe.name}
              </span>
              {sourceNameOf(recipe) && (
                <span className="block font-display text-[12px] text-ink-soft truncate">
                  from {sourceNameOf(recipe)}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setRecipe(null)}
              aria-label="Remove recipe"
              className="flex-none w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink flex items-center justify-center shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-ink/50 bg-card py-3 font-display font-bold text-[14px] text-ink-soft active:translate-y-[1px] transition-transform"
          >
            <Icon name="plus" className="w-4 h-4" />
            Attach one of your recipes
          </button>
        )}
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

      {pickerOpen && (
        <RecipePicker onPick={attachRecipe} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
