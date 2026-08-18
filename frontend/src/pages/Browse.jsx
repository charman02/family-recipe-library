import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import RecipeCard from '../components/RecipeCard'
import IconField from '../components/IconField'
import MarkerTitle from '../components/MarkerTitle'
import FilterSelect from '../components/FilterSelect'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { matchesCuisine } from '../lib/cuisineMatch'

const CUISINES = [
  'Japanese',
  'Korean',
  'Chinese',
  'Filipino',
  'Vietnamese',
  'Thai',
  'Indian',
  'Middle Eastern',
  'Mexican',
  'Italian',
  'West African',
  'Caribbean',
]

const DIETS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Halal',
  'Kosher',
]

// "Ready In" buckets — max prep time in minutes (0 = any).
const READY_IN = [
  { value: '0', label: 'Any time' },
  { value: '15', label: 'Under 15 min' },
  { value: '30', label: 'Under 30 min' },
  { value: '60', label: 'Under 1 hour' },
]

const withAny = (label, values) => [
  { value: '', label: `All ${label}` },
  ...values.map((v) => ({ value: v, label: v })),
]

// Marker-swipe colors cycled across the browse section headers for visual rhythm.
// Rotated across section headers. Four warm swatches — periwinkle used to be the
// fourth and was the only cool colour in the app; peach carries the slot instead.
const SECTION_COLORS = ['bg-saffron', 'bg-sage', 'bg-brick', 'bg-peach']

// Curated section rows for the default (non-search) browse view.
function buildSections(recipes) {
  const sections = CUISINES.map((cuisine) => ({
    title: cuisine,
    recipes: recipes.filter((r) => matchesCuisine(r.cuisine, cuisine)),
  }))

  sections.push({
    title: 'Quick & Easy',
    recipes: recipes.filter(
      (r) => r.prep_time_minutes != null && r.prep_time_minutes <= 30,
    ),
  })

  sections.push({
    title: 'Recently Added',
    recipes: [...recipes].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    ),
  })

  return sections
}

export default function Browse() {
  const [recipes, setRecipes] = useState(null)
  const [search, setSearch] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [diet, setDiet] = useState('')
  const [readyIn, setReadyIn] = useState('0')
  const navigate = useNavigate()

  useEffect(() => {
    client
      .get('/recipes/browse')
      .then((res) => setRecipes(res.data))
      .catch(() => setRecipes([]))
  }, [])

  function clearAll() {
    setSearch('')
    setCuisine('')
    setDiet('')
    setReadyIn('0')
  }

  if (recipes === null) {
    return <Loader />
  }

  // Apply search + dropdown filters uniformly.
  const searchQuery = search.trim()
  const maxPrep = Number(readyIn)
  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
    const cuisineOk = matchesCuisine(r.cuisine, cuisine)
    const matchesDiet =
      !diet || (r.diet || '').toLowerCase().includes(diet.toLowerCase())
    const matchesReadyIn =
      maxPrep === 0 ||
      (r.prep_time_minutes != null && r.prep_time_minutes <= maxPrep)
    return matchesSearch && cuisineOk && matchesDiet && matchesReadyIn
  })

  // Searching OR any dropdown active → flat results (no section rows). Only the
  // default, unfiltered view shows the curated cuisine/recency sections.
  const isFiltering =
    searchQuery !== '' || cuisine !== '' || diet !== '' || maxPrep !== 0

  const sections = buildSections(filteredRecipes).filter(
    (section) => section.recipes.length > 0,
  )

  return (
    <div className="min-h-screen bg-cream pt-6">
      <div className="px-4">
        <MarkerTitle
          color="bg-brick"
          className="font-display font-black text-[32px] text-ink leading-none"
        >
          Browse<span className="text-terra">.</span>
        </MarkerTitle>
        <p className="font-display italic text-[15px] text-ink-soft mt-3">
          Recipes from every kitchen.
        </p>

        <IconField
          icon="search"
          iconClassName="text-ink-soft"
          type="text"
          placeholder="Search recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="mt-3.5"
        />

        {/* Dropdown filter row — the reference's Ready In / Type / Person shelf. */}
        <div className="flex gap-2 mt-3">
          <FilterSelect
            label="Cuisine"
            value={cuisine}
            onChange={setCuisine}
            options={withAny('cuisines', CUISINES)}
          />
          <FilterSelect
            label="Diet"
            value={diet}
            onChange={setDiet}
            options={withAny('diets', DIETS)}
          />
          <FilterSelect
            label="Ready In"
            value={readyIn}
            onChange={setReadyIn}
            options={READY_IN}
          />
        </div>

        {isFiltering && (
          <div className="flex items-center justify-between mt-3">
            <span className="font-display font-bold text-[13px] text-ink">
              {filteredRecipes.length}{' '}
              {filteredRecipes.length === 1 ? 'result' : 'results'}
            </span>
            <button
              onClick={clearAll}
              className="font-display font-bold text-[12.5px] text-terra underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* RESULTS.
          Filtering → one flat grid of matches (no section titles).
          Default → curated horizontal-scroll section rows. */}
      {isFiltering ? (
        filteredRecipes.length === 0 ? (
          <div className="px-4 mt-8">
            <EmptyState
              icon="🔍"
              badge="bg-brick"
              title="No recipes match"
              sub="Try clearing a filter or two."
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-5">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                variant="grid"
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              />
            ))}
          </div>
        )
      ) : sections.length === 0 ? (
        <div className="px-4 mt-8">
          <EmptyState
            icon="🍳"
            title="Nothing here yet"
            sub="Recipes people share will show up here."
          />
        </div>
      ) : (
        <div>
          {sections.map((section, i) => (
            <section key={section.title}>
              <div className="px-4 mt-6 mb-3">
                <MarkerTitle
                  as="h3"
                  color={SECTION_COLORS[i % SECTION_COLORS.length]}
                  rotate={i % 2 === 0 ? '-rotate-1' : 'rotate-1'}
                  className="font-display font-black text-[21px] text-ink leading-none"
                >
                  {section.title}
                </MarkerTitle>
              </div>
              <div className="flex gap-3.5 overflow-x-auto px-4 pb-1 scrollbar-hide">
                {section.recipes.map((recipe) => (
                  <RecipeCard
                    key={`${section.title}-${recipe.id}`}
                    recipe={recipe}
                    variant="row"
                    onClick={() => navigate(`/recipes/${recipe.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
