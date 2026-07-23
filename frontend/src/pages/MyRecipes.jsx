import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import GardenBed from '../components/GardenBed'
import IconField from '../components/IconField'
import { gardenBands } from '../lib/gardenBands'

export default function MyRecipes() {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    client
      .get('/recipes')
      .then((res) => setRecipes(res.data))
      .catch(() => {})
  }, [])

  const query = search.trim()
  const searching = query.length > 0
  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()),
  )
  // Not searching → the garden by growth band. Searching → ONE untitled bed of
  // matches (still plants, never cards; grouping a filtered subset makes
  // confusing single-plant bands). See garden-liveliness spec §4.5.
  const bands = searching ? [] : gardenBands(recipes)

  return (
    <div className="px-4 pt-6">
      <h1 className="font-serif font-black text-[28px] text-ink">
        Your Garden
      </h1>
      <p className="font-serif italic text-sm text-ink-soft mt-0.5">
        A garden of everything you’ve kept.
      </p>

      <button
        onClick={() => navigate('/shared')}
        className="mt-2 font-sans text-[11.5px] font-semibold text-terra"
      >
        Shared with you →
      </button>

      <IconField
        icon="search"
        iconClassName="text-ink-soft"
        type="text"
        placeholder="Search recipes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        wrapperClassName="mt-3.5 mb-4"
      />

      {searching ? (
        <GardenBed recipes={filtered} />
      ) : (
        bands.map((band) => (
          <GardenBed
            key={band.key}
            title={band.title}
            blurb={band.blurb}
            recipes={band.recipes}
          />
        ))
      )}

      {searching && filtered.length === 0 && (
        <p className="text-center text-ink-soft text-sm mt-8">
          No plants match “{query}”.
        </p>
      )}
      {!searching && recipes.length === 0 && (
        <p className="text-center text-ink-soft text-sm mt-8">
          Your garden’s just getting started. Plant your first seed.
        </p>
      )}
    </div>
  )
}
