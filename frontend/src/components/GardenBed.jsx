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
      {/* Each plant unit owns its own soil so alignment is LOCAL and robust
          (no fragile shared absolute strip guessed against a flex column):
          - the plant row bottom-aligns the plants; each plant's visible base is
            ~6px above its svg box bottom, so -mb-[6px] drops that base to the
            row's baseline;
          - the soil strip is the NEXT block, overlapping upward (-mt) so the
            plant base sits IN it; it's opaque + in front (z-10) to hide the base;
          - the caption flows naturally below the soil (no fixed height → no
            clipping of the chips). */}
      <div className="flex gap-[18px] px-4 overflow-x-auto scrollbar-hide">
        {recipes.map((recipe) => {
          const source = sourceNameOf(recipe)
          return (
            <button
              key={recipe.id}
              onClick={() => navigate(`/recipes/${recipe.id}`)}
              className="flex-[0_0_120px] flex flex-col items-center rounded-xl hover:bg-white/20 transition"
            >
              {/* plant, bottom-aligned in a fixed-height stage so heights vary
                  but all bases land on one line */}
              <span className="flex h-[152px] items-end">
                <span className="-mb-[6px]">
                  <GardenPlant
                    stage={stageForRecipe(recipe)}
                    vitality={vitalityForRecipe(recipe)}
                    reduceMotion={reduceMotion}
                  />
                </span>
              </span>
              {/* soil — overlaps up into the plant base, opaque, in front */}
              <span
                className="relative z-10 -mt-[14px] h-[26px] w-full pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg,#8A5E34 0%,#6E4B29 55%,#543920 100%)',
                  clipPath:
                    'polygon(0% 32%,12% 16%,25% 30%,38% 15%,50% 28%,62% 15%,75% 30%,88% 16%,100% 26%,100% 100%,0% 100%)',
                }}
              />
              {/* caption — natural height below the soil, never clipped */}
              <span className="block max-w-[116px] pt-1.5 pb-1 text-center">
                <span className="block font-serif font-bold text-[15px] text-ink leading-tight truncate">
                  {recipe.name}
                </span>
                {source && (
                  <span className="block text-[10px] font-bold tracking-[0.2px] text-plum">
                    from {source}
                  </span>
                )}
                {(recipe.cuisine || recipe.cook_count > 0) && (
                  <span className="mt-1 flex flex-wrap justify-center gap-1">
                    {recipe.cuisine && (
                      <span className="rounded-full px-[7px] py-[2px] text-[8.5px] font-bold uppercase tracking-[0.3px] text-growth bg-growth/[0.12]">
                        {recipe.cuisine}
                      </span>
                    )}
                    {recipe.cook_count > 0 && (
                      <span className="rounded-full px-[7px] py-[2px] text-[8.5px] font-bold uppercase tracking-[0.3px] text-terra bg-terra/10">
                        cooked {recipe.cook_count}×
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
