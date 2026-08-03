import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/sharing', () => ({
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
// RecipeForm is heavy; stub it to immediately submit a minimal payload. The stub
// renders the slots (topSlot carries the source fields, beforeSubmitSlot the
// visibility choice) and records storyVariant, since branching that prompt by
// path is part of what this flow owes the user.
let lastProps = null
vi.mock('../components/RecipeForm', () => ({
  default: (props) => {
    lastProps = props
    const {
      onSubmit,
      intro = null,
      topSlot = null,
      beforeSubmitSlot = null,
    } = props
    return (
      <div>
        {topSlot}
        {intro}
        {beforeSubmitSlot}
        <button
          onClick={() =>
            onSubmit({
              name: 'Congee',
              ingredients: [],
              steps: [],
              story: 'typed in the form',
            })
          }
        >
          submit-form
        </button>
      </div>
    )
  },
}))
import { plantRecipe } from '../api/sharing'
import PlantRecipe from './PlantRecipe'

beforeEach(() => {
  plantRecipe.mockClear()
  lastProps = null
})

function renderFlow() {
  render(
    <MemoryRouter>
      <PlantRecipe />
    </MemoryRouter>,
  )
}

const enterDoor = (name) => userEvent.click(screen.getByRole('button', { name }))

describe('PlantRecipe', () => {
  it('goes doorway → form in ONE hop (the source step was folded in)', async () => {
    // The flow used to be doorway → source → form. Testers found it too
    // effortful, so the source fields moved into the top of the form itself.
    renderFlow()
    await enterDoor(/passed down to you/i)
    // No intermediate "continue to the recipe" screen any more: the form is here.
    expect(
      screen.getByRole('button', { name: /submit-form/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/whose recipe is this\?/i)).toBeInTheDocument()
  })

  it('self-authored path never asks who taught you', async () => {
    renderFlow()
    await enterDoor(/one of your own/i)
    expect(screen.queryByText(/whose recipe is this\?/i)).not.toBeInTheDocument()
    expect(lastProps.storyVariant).toBe('own')
  })

  it('inherited path asks for the source and sends it as attribution', async () => {
    renderFlow()
    await enterDoor(/passed down to you/i)
    expect(lastProps.storyVariant).toBe('inherited')

    await userEvent.type(screen.getByPlaceholderText(/lola remedios/i), 'Lola')
    await userEvent.type(screen.getByPlaceholderText(/cebu/i), 'Cebu')
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))

    const payload = plantRecipe.mock.calls[0][0]
    expect(payload.origin.name).toBe('Lola')
    expect(payload.origin.place).toBe('Cebu')
    // ONE story input: the dish's story comes from the form, never from a
    // separate source-memory field that could disagree with it.
    expect(payload.story).toBe('typed in the form')
  })

  it('sends no origin when the source name is left blank', async () => {
    // Attribution is optional even on the inherited path — a half-filled source
    // block must not create an origin record with an empty name.
    renderFlow()
    await enterDoor(/passed down to you/i)
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].origin ?? null).toBeNull()
  })

  it('sends no origin on the self-authored path', async () => {
    renderFlow()
    await enterDoor(/one of your own/i)
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].origin ?? null).toBeNull()
  })

  it('confirms the save and names the next acts', async () => {
    renderFlow()
    await enterDoor(/one of your own/i)
    // The capture step frames itself as low-pressure.
    expect(screen.getByText(/a splash of vinegar/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))

    expect(await screen.findByText('Congee is saved.')).toBeInTheDocument()
    expect(screen.getByText(/saved to your kitchen/i)).toBeInTheDocument()
    // no source name on this path → the generic act
    expect(screen.getByText(/add a memory/i)).toBeInTheDocument()
    // The CTA names its destination — "Take me to it" left testers unsure what
    // "it" was.
    expect(
      screen.getByRole('button', { name: /view congee/i }),
    ).toBeInTheDocument()
  })

  it('back from the form returns to the doorway, not out of the flow', async () => {
    renderFlow()
    await enterDoor(/passed down to you/i)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(
      screen.getByRole('button', { name: /passed down to you/i }),
    ).toBeInTheDocument()
  })
})

// The create-time visibility choice is the ONLY thing that can ever put a recipe
// in Browse, so these lock both directions: the safe default, and the opt-in.
describe('PlantRecipe visibility', () => {
  async function reachTheForm() {
    renderFlow()
    await enterDoor(/one of your own/i)
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
