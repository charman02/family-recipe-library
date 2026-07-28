import CoverImage from './CoverImage'
import { sourceNameOf } from '../lib/sourceName'

// The recipe card in the "Kamala's Recipes" sticker language: the food photo
// sits in a bold ink-outlined frame with a hard offset shadow (a sticker), an
// outlined cuisine tag pinned to the corner, then a chunky Fraunces title and a
// small italic byline beneath. No plant/growth iconography (classic kitchen).
//
// variant: "grid" (fills its cell — two-up rows) | "row" (fixed width, for the
// horizontal-scroll rows on Browse). onClick navigates to the recipe.
export default function RecipeCard({ recipe, onClick, variant = 'grid' }) {
  const widthClass = variant === 'row' ? 'w-[210px] flex-none' : 'w-full'
  // Byline: a quiet verb ("from" / "kept by") + the person's name emphasized.
  const source = sourceNameOf(recipe)
  const byline = source
    ? { verb: 'from', name: source }
    : recipe.author_full_name
      ? { verb: 'kept by', name: recipe.author_full_name }
      : null

  return (
    <button
      onClick={onClick}
      className={`${widthClass} group text-left bg-transparent`}
    >
      <div className="relative sticker sticker-press overflow-hidden bg-card">
        <CoverImage
          url={recipe.cover_photo_url}
          size="md"
          className="w-full h-[150px] object-cover block"
        />
        {recipe.cuisine && (
          <span className="absolute top-2 left-2 font-display font-bold uppercase tracking-[0.06em] text-[9.5px] text-ink bg-saffron border-2 border-ink px-2 py-0.5 rounded-full">
            {recipe.cuisine}
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2.5">
        <p className="font-display font-black text-[19px] leading-[1.04] text-ink">
          {recipe.name}
        </p>
        {byline && (
          <p className="text-[13px] mt-0.5">
            <span className="font-sans text-ink-soft/80">{byline.verb} </span>
            <span className="font-display font-bold italic text-plum">
              {byline.name}
            </span>
          </p>
        )}
      </div>
    </button>
  )
}
