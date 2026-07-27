import CoverImage from './CoverImage'
import { sourceNameOf } from '../lib/sourceName'

// The recipe card, restyled to the "Kamala's Recipes" reference: a food photo
// in a soft-rounded frame, then a big Fraunces title centered beneath it with a
// small italic byline. No plant/growth iconography (classic kitchen, not garden).
//
// variant: "grid" (fills its cell — two-up rows) | "row" (fixed width, for any
// horizontal-scroll rows). onClick navigates to the recipe.
export default function RecipeCard({ recipe, onClick, variant = 'grid' }) {
  const widthClass = variant === 'row' ? 'w-[200px] flex-none' : 'w-full'

  return (
    <button
      onClick={onClick}
      className={`${widthClass} text-left bg-transparent transition-transform active:scale-[0.98]`}
    >
      <div className="relative">
        <CoverImage
          url={recipe.cover_photo_url}
          size="md"
          className="w-full h-[136px] rounded-[16px] object-cover border border-line shadow-[0_8px_20px_-12px_rgba(80,50,20,0.35)]"
        />
        {recipe.cuisine && (
          <span className="absolute top-2 left-2 font-display font-semibold uppercase tracking-[0.1em] text-[9px] text-ink bg-cream/95 px-2.5 py-1 rounded-full shadow-sm">
            {recipe.cuisine}
          </span>
        )}
      </div>
      <div className="px-0.5 pt-2.5 text-center">
        <p className="font-display font-bold text-[18px] leading-[1.06] text-ink">
          {recipe.name}
        </p>
        {(sourceNameOf(recipe) || recipe.author_full_name) && (
          <p className="font-display italic text-[12.5px] text-plum mt-0.5">
            {sourceNameOf(recipe)
              ? `from ${sourceNameOf(recipe)}`
              : `kept by ${recipe.author_full_name}`}
          </p>
        )}
      </div>
    </button>
  )
}
