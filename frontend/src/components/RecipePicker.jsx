import { useState, useEffect } from 'react'
import client from '../api/client'
import { sourceNameOf } from '../lib/sourceName'
import Icon from './Icon'
import Loader from './Loader'
import EmptyState from './EmptyState'

// A bottom-sheet picker for attaching one of YOUR OWN recipes to a post (#72). Lists the
// caller's recipes from GET /recipes (already self-scoped server-side — it only ever
// returns your own, non-deleted), with a name search. Tapping one calls onPick(recipe)
// and the parent closes the sheet.
//
// It does NOT enforce ownership itself — GET /recipes is the authority (self-only), and
// create_post re-checks that recipe_id belongs to the caller before linking. This is a
// convenience list, not a trust boundary.
export default function RecipePicker({ onPick, onClose }) {
  const [recipes, setRecipes] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    client
      .get('/recipes')
      .then((res) => setRecipes(res.data))
      .catch(() => setRecipes([]))
  }, [])

  const query = search.trim().toLowerCase()
  const filtered = (recipes || []).filter((r) =>
    query ? r.name.toLowerCase().includes(query) : true,
  )

  return (
    // Full-screen scrim; tapping it closes. The sheet stops propagation so a tap inside
    // doesn't dismiss. Anchored to the bottom on a phone (thumb reach), centered on wider.
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Attach a recipe"
        className="sticker bg-card w-full max-w-sm max-h-[80vh] flex flex-col p-5 mb-4 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-black text-[20px] text-ink leading-none">
            Attach a recipe
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-none w-8 h-8 rounded-full bg-cream border-2 border-ink text-ink flex items-center justify-center shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search your recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search your recipes"
          className="field mb-3"
        />

        {/* The list scrolls within the sheet; the header + search stay put. */}
        <div className="overflow-y-auto -mx-1 px-1">
          {recipes === null ? (
            <Loader />
          ) : recipes.length === 0 ? (
            <EmptyState
              icon="🍲"
              title="No recipes yet"
              sub="Keep a recipe first, then you can attach it to a meal."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              badge="bg-brick"
              title={`No recipes match “${search.trim()}”`}
              sub="Try a different word."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => {
                const source = sourceNameOf(r)
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => onPick(r)}
                      className="flex w-full items-center gap-3 text-left rounded-[14px] border-2 border-ink bg-cream p-2 shadow-[0_2px_0_#2E3A24] active:translate-y-[1px] active:shadow-none transition-transform"
                    >
                      {/* Cover thumbnail, or a pot glyph when the recipe has no photo. */}
                      {r.cover_photo_url ? (
                        <img
                          src={r.cover_photo_url}
                          alt=""
                          className="flex-none w-11 h-11 rounded-[10px] border-2 border-ink object-cover"
                        />
                      ) : (
                        <span className="flex-none flex items-center justify-center w-11 h-11 rounded-[10px] border-2 border-ink bg-peach text-ink">
                          <Icon name="pot" className="w-5 h-5" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-display font-bold text-[15px] text-ink truncate">
                          {r.name}
                        </span>
                        {source && (
                          <span className="block font-display text-[12px] text-ink-soft truncate">
                            from {source}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
