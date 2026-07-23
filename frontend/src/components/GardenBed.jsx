// frontend/src/components/GardenBed.jsx
// One garden bed: an optional band title/blurb, then a horizontal scrolling row
// of recipe-plants standing in a soil strip, each with a caption (name + "from
// {source}") locked beneath it. Tapping a plant opens its recipe page. Layout
// values (120px slot, 18px gap, 22px soil, 8px sink) from the approved mockup.
import { useNavigate } from 'react-router-dom'
import GardenPlant from './GardenPlant'
import { stageForRecipe, vitalityForRecipe } from '../lib/growth'
import { sourceNameOf } from '../lib/sourceName'

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function GardenBed({ title, blurb, recipes }) {
  const navigate = useNavigate()
  if (!recipes || recipes.length === 0) return null
  return (
    <section className="mb-6">
      {title && (
        <h2 className="font-serif font-bold text-[17px] text-ink">{title}</h2>
      )}
      {title && blurb && (
        <p className="font-serif italic text-[12.5px] text-ink-soft mb-2.5">
          {blurb}
        </p>
      )}
      <div className="relative">
        <div className="flex items-end gap-[18px] px-4 overflow-x-auto scrollbar-hide min-h-[158px]">
          {recipes.map((recipe) => {
            const source = sourceNameOf(recipe)
            return (
              <button
                key={recipe.id}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                className="flex-[0_0_120px] flex flex-col items-center justify-end rounded-xl hover:bg-white/20 transition"
              >
                <span className="mb-[8px]">
                  <GardenPlant
                    stage={stageForRecipe(recipe)}
                    vitality={vitalityForRecipe(recipe)}
                    reduceMotion={reduceMotion}
                  />
                </span>
                <span className="block max-w-[112px] text-center">
                  <span className="block font-serif font-semibold text-[13px] text-ink leading-tight truncate">
                    {recipe.name}
                  </span>
                  {source && (
                    <span className="block text-[9.5px] font-bold tracking-[0.2px] text-plum">
                      from {source}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {/* soil strip the plants are rooted into */}
        <div className="absolute left-0 right-0 bottom-[38px] h-[22px] -z-10 bg-[linear-gradient(180deg,#D8B88C_0%,#C9A277_55%,#B0864F_100%)]" />
      </div>
    </section>
  )
}
