import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/lineage', () => ({
  plantRecipe: vi.fn(() =>
    Promise.resolve({
      data: {
        id: 42,
        name: 'Congee',
        growth_stage: 'sprout',
        growth_vitality: 'bare',
      },
    }),
  ),
}))
// RecipeForm is heavy; stub it to immediately submit a minimal payload. The
// stub echoes back initialValues.story (seeded from the doorway memory) so the
// test proves the form's story — not a separate override — is what's sent, and
// exposes initialValues so we can assert the mine-path seed is passed through.
let lastInitialValues = null
vi.mock('../components/RecipeForm', () => ({
  default: ({
    onSubmit,
    initialValues = {},
    intro = null,
    beforeSubmitSlot = null,
  }) => {
    lastInitialValues = initialValues
    return (
      <div>
        {intro}
        {beforeSubmitSlot}
        <button
          onClick={() =>
            onSubmit({
              name: 'Congee',
              ingredients: [],
              steps: [],
              story: initialValues.story || null,
            })
          }
        >
          submit-form
        </button>
      </div>
    )
  },
}))
import { plantRecipe } from '../api/lineage'
import PlantRecipe from './PlantRecipe'

beforeEach(() => {
  plantRecipe.mockClear()
  lastInitialValues = null
})

describe('PlantRecipe', () => {
  it('walks doorway → mine → form → saved, sending story not origin', async () => {
    render(
      <MemoryRouter>
        <PlantRecipe />
      </MemoryRouter>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /one of your own/i }),
    )
    await userEvent.type(
      screen.getByPlaceholderText(/what made this yours/i),
      'I riffed on it for years',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /continue to the recipe/i }),
    )

    // Mine path seeds RecipeForm's Story field with the doorway memory, so
    // there is a single, editable story input (no competing second field).
    expect(lastInitialValues).toEqual({ story: 'I riffed on it for years' })

    // The capture flow frames the recipe step as low-pressure (spec §3.2.3).
    expect(screen.getByText(/a splash of vinegar/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe).toHaveBeenCalled()
    const payload = plantRecipe.mock.calls[0][0]
    expect(payload.origin ?? null).toBeNull()
    // Story comes straight from the form payload (seeded from selfMemory),
    // with no silent override in handleFormSubmit.
    expect(payload.story).toBe('I riffed on it for years')
    // The saved beat confirms the recipe and names the next acts.
    expect(await screen.findByText('Congee is saved.')).toBeInTheDocument()
    expect(screen.getByText(/saved to your kitchen/i)).toBeInTheDocument()
    // Mine path has no source name → generic "add a memory"
    expect(screen.getByText(/add a memory/i)).toBeInTheDocument()
    // a secondary CTA takes you straight to the recipe
    expect(
      screen.getByRole('button', { name: /take me to it/i }),
    ).toBeInTheDocument()
  })

  it('mine path: an edited form story is authoritative (no doorway override)', async () => {
    render(
      <MemoryRouter>
        <PlantRecipe />
      </MemoryRouter>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /one of your own/i }),
    )
    await userEvent.type(
      screen.getByPlaceholderText(/what made this yours/i),
      'seed memory',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /continue to the recipe/i }),
    )

    // Simulate the user editing the pre-filled Story field in the real form:
    // the payload the form emits — not selfMemory — is what must be sent.
    lastInitialValues.story = 'a richer, edited story'
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))

    const payload = plantRecipe.mock.calls[0][0]
    expect(payload.story).toBe('a richer, edited story')
    expect(payload.origin ?? null).toBeNull()
  })
})

// The create-time visibility choice is the ONLY thing that can ever put a recipe
// in Browse, so these lock both directions: the safe default, and the opt-in.
describe('PlantRecipe visibility', () => {
  async function reachTheForm() {
    render(
      <MemoryRouter>
        <PlantRecipe />
      </MemoryRouter>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /one of your own/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /continue to the recipe/i }),
    )
  }

  it('renders the choice on the form step with "Only me" preselected', async () => {
    await reachTheForm()
    expect(screen.getByText(/who can see this\?/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /only me/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /everyone/i })).not.toBeChecked()
  })

  it('sends visibility private without the user touching the choice', async () => {
    await reachTheForm()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].visibility).toBe('private')
  })

  it('sends visibility public once the user opts in', async () => {
    await reachTheForm()
    await userEvent.click(screen.getByRole('radio', { name: /everyone/i }))
    expect(screen.getByRole('radio', { name: /everyone/i })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].visibility).toBe('public')
  })
})
