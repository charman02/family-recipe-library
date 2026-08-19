import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { buildOriginPayload } from '../lib/originPayload'

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
  // Unavailable by default, so every existing paste test exercises the LOCAL parser
  // fallback — which is the path that has to keep working when the model is down.
  parseRecipeWithAI: vi.fn(() => Promise.resolve({ data: { ai: false } })),
}))
// RecipeForm is heavy; stub it to immediately submit a minimal payload. The real
// form now OWNS the optional "Passed down from" field and builds the origin into
// its own payload, so the stub mirrors that: it seeds a source input from
// initialValues.sourceName and includes buildOriginPayload({ name }) on submit.
let lastProps = null
vi.mock('../components/RecipeForm', () => ({
  default: (props) => {
    lastProps = props
    const {
      onSubmit,
      onQuickSave,
      initialValues = {},
      intro = null,
      topSlot = null,
      beforeSubmitSlot = null,
    } = props
    return (
      <div>
        {topSlot}
        {intro}
        {beforeSubmitSlot}
        <label>
          Passed down from (optional)
          <input
            aria-label="Passed down from (optional)"
            defaultValue={initialValues.sourceName || ''}
          />
        </label>
        <button
          onClick={() => {
            const src = document.querySelector(
              'input[aria-label="Passed down from (optional)"]',
            ).value
            onSubmit({
              name: 'Congee',
              origin: buildOriginPayload({ name: src }),
              ingredients: [],
              steps: [],
              story: 'typed in the form',
            })
          }}
        >
          submit-form
        </button>
        {onQuickSave && (
          <button onClick={() => onQuickSave('Congee')}>quick-save</button>
        )}
      </div>
    )
  },
}))
// The save celebration is decorative; its reveal IS the terminal saved screen
// (checkmark + card + share). Stub it to expose the two actions as buttons so the
// page's wiring (view → recipe page, share → handoff) is testable without waiting
// on animation timers. Its own animation is covered in SaveCelebration.test.jsx.
vi.mock('../components/SaveCelebration', () => ({
  default: ({ recipe, onView, onShare }) => (
    <div>
      <p>celebration for {recipe?.name}</p>
      <button onClick={onView}>celebrate-view</button>
      <button onClick={onShare}>celebrate-share</button>
    </div>
  ),
}))
import { plantRecipe, parseRecipeWithAI } from '../api/sharing'
import PlantRecipe from './PlantRecipe'

beforeEach(() => {
  plantRecipe.mockClear()
  parseRecipeWithAI.mockClear()
  parseRecipeWithAI.mockResolvedValue({ data: { ai: false } })
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

describe('PlantRecipe — lands straight on say/paste, with a type-it-in link', () => {
  it('opens directly on the say/paste screen (no transitional doorway)', () => {
    renderFlow()
    // The say/paste screen IS the entry now — no intermediate "Say it or paste it"
    // card to click through first.
    expect(screen.getByRole('heading', { name: /add it your way/i })).toBeInTheDocument()
    // The blank-form escape hatch is a quiet link at the bottom of this screen, not a
    // co-equal card and not a separate doorway.
    expect(
      screen.getByRole('button', { name: /rather type it in/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /fill it in yourself/i }),
    ).toBeNull()
  })

  it('the form door lands straight on the form', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    expect(
      screen.getByRole('button', { name: /submit-form/i }),
    ).toBeInTheDocument()
  })

  it('the source is asked on the form itself, not as its own step', async () => {
    // The doorway no longer forks on "inherited vs your own"; the form carries a
    // single optional "Passed down from" field.
    renderFlow()
    await enterDoor(/rather type it in/i)
    expect(
      screen.getByLabelText(/passed down from/i),
    ).toBeInTheDocument()
  })

  it('sends the origin when a source name is filled in', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    await userEvent.type(screen.getByLabelText(/passed down from/i), 'Lola')
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].origin.name).toBe('Lola')
    // ONE story input: the dish's story comes from the form, never a separate field.
    expect(plantRecipe.mock.calls[0][0].story).toBe('typed in the form')
  })

  it('sends no origin when the source name is left blank', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].origin ?? null).toBeNull()
  })

  it('lands on the save celebration, carrying the saved recipe', async () => {
    // The celebration's reveal is the terminal saved screen now (checkmark + card
    // + share); the old text-only "Congee is saved." screen was replaced by it.
    renderFlow()
    await enterDoor(/rather type it in/i)
    expect(screen.getByText(/a splash of vinegar/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))

    expect(
      await screen.findByText(/celebration for Congee/i),
    ).toBeInTheDocument()
  })

  it('share from the celebration goes to the hand-off step', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    await userEvent.click(
      await screen.findByRole('button', { name: /celebrate-share/i }),
    )
    // The hand-off compose screen is now showing.
    expect(
      await screen.findByRole('button', { name: /get a link to send/i }),
    ).toBeInTheDocument()
  })

  it('back from the type-it-in form returns to the say/paste screen, not out of the flow', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    // Back on the say/paste screen (its heading + the type-it-in link are present).
    expect(screen.getByRole('heading', { name: /add it your way/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /rather type it in/i }),
    ).toBeInTheDocument()
  })
})

// The create-time visibility choice is the ONLY thing that can ever put a recipe
// in Browse, so these lock both directions: the public default, and opting down.
describe('PlantRecipe visibility', () => {
  async function reachTheForm() {
    renderFlow()
    await enterDoor(/rather type it in/i)
  }

  it('preselects "Friends only" for a private-profile author (the default)', async () => {
    // No issei_user in storage → profile treated as private → default "friends".
    await reachTheForm()
    expect(screen.getByText(/who can see this\?/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /friends only/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /everyone/i })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /only me/i })).not.toBeChecked()
  })

  it('sends visibility friends without the user touching the choice', async () => {
    await reachTheForm()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].visibility).toBe('friends')
  })

  it('sends visibility public once the user opts up to "Everyone"', async () => {
    await reachTheForm()
    await userEvent.click(screen.getByRole('radio', { name: /everyone/i }))
    expect(screen.getByRole('radio', { name: /everyone/i })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].visibility).toBe('public')
  })

  it('sends visibility private once the user opts down to "Only me"', async () => {
    await reachTheForm()
    await userEvent.click(screen.getByRole('radio', { name: /only me/i }))
    expect(screen.getByRole('radio', { name: /only me/i })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    expect(plantRecipe.mock.calls[0][0].visibility).toBe('private')
  })
})

// PASTE — the second door. It exists because the form asks for many fields when only the
// dish name is required, and testers called capture "too effortful".
describe('PlantRecipe — pasting a whole recipe', () => {
  const PASTED = ['Adobo', '3 soup spoons soy sauce', 'Brown the chicken'].join('\n')
  const GUESSED = ['Adobo', '2 cups rice', 'Boil it'].join('\n')
  const HEADERED = [
    'Adobo',
    'Ingredients:',
    '2 cups rice',
    'Instructions:',
    'Boil it',
  ].join('\n')

  async function openPaste() {
    // The say/paste screen is the entry point now — no card to click first.
    renderFlow()
  }

  async function paste(text) {
    await openPaste()
    await userEvent.type(screen.getByRole('textbox'), text)
    await userEvent.click(screen.getByRole('button', { name: /sort this out/i }))
  }

  it('opens on say/paste, with the type-it-in link below it', async () => {
    renderFlow()
    const heading = screen.getByRole('heading', { name: /add it your way/i })
    const form = screen.getByRole('button', { name: /rather type it in/i })
    // 4 === Node.DOCUMENT_POSITION_FOLLOWING: the type-it-in link comes AFTER the
    // say/paste screen's heading.
    expect(heading.compareDocumentPosition(form) & 4).toBeTruthy()
  })

  it('lands on the form with the recipe already sorted', async () => {
    await paste(PASTED)
    expect(lastProps.initialValues.name).toBe('Adobo')
    expect(lastProps.initialValues.ingredients).toEqual([
      { name: 'soy sauce', quantity: '3 soup spoons' },
    ])
    expect(lastProps.initialValues.steps[0].content).toBe('Brown the chicken')
  })

  it('says how much it guessed, instead of presenting a guess as fact', async () => {
    await paste(GUESSED)
    expect(screen.getByText(/sorted 2 lines/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing is saved yet/i)).toBeInTheDocument()
  })

  it('credits the author’s own headings rather than claiming a guess', async () => {
    await paste(HEADERED)
    expect(screen.getByText(/using your own headings/i)).toBeInTheDocument()
  })

  it('will not sort a single line — that is a name, not a recipe', async () => {
    await openPaste()
    await userEvent.type(screen.getByRole('textbox'), 'Adobo')
    expect(screen.getByRole('button', { name: /sort this out/i })).toBeDisabled()
    expect(plantRecipe).not.toHaveBeenCalled()
  })

  it('saves nothing until the form is submitted', async () => {
    await paste(GUESSED)
    expect(plantRecipe).not.toHaveBeenCalled()
  })

  it('goes back to the paste box from the form, keeping the text', async () => {
    await paste(GUESSED)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('textbox')).toHaveValue(GUESSED)
  })
})

// NAME-ONLY SAVE — the escape hatch for the failure testers described: one abandoned
// the form mid-way, and abandoning meant losing everything typed.
describe('PlantRecipe — keeping just the name', () => {
  it('saves with the dish name alone, then celebrates', async () => {
    renderFlow()
    await enterDoor(/rather type it in/i)
    await userEvent.click(screen.getByRole('button', { name: /quick-save/i }))
    expect(plantRecipe).toHaveBeenCalledWith({
      name: 'Congee',
      visibility: 'friends',
    })
    // Same celebration reveal as a full save — a name-only recipe is a smaller
    // recipe, not a different kind of thing.
    expect(
      await screen.findByText(/celebration for Congee/i),
    ).toBeInTheDocument()
  })
})

// THE LLM LAYER. The local parser cannot split run-on speech — one spoken sentence
// holding three ingredients — and that is exactly how a person tells you how they cook.
// The model goes first for that reason; the local parser stays as the floor.
describe('PlantRecipe — the model reads it first', () => {
  // A correctly-shaped paste, for the fallback cases: the local parser needs one item
  // per line, which is the requirement the model removes.
  const TIDY = ['Adobo', '2 cups rice', 'Boil it'].join('\n')

  const SPOKEN =
    'sinigang from my lola. you need tamarind, about a thumb of ginger, and some kangkong. boil the pork until tender, then add the tamarind.'

  const AI_ANSWER = {
    ai: true,
    name: 'Sinigang',
    source_name: 'Lola',
    description: 'Sour pork soup.',
    servings: '4',
    cuisine: 'Filipino',
    ingredients: [
      { name: 'tamarind', amount: '', quantity_type: 'unmeasured' },
      { name: 'ginger', amount: 'about a thumb', quantity_type: 'unmeasured' },
      { name: 'kangkong', amount: 'some', quantity_type: 'unmeasured' },
    ],
    steps: [
      { content: 'Boil the pork until tender', note: '' },
      { content: 'Add the tamarind', note: "don't overcook the greens" },
    ],
  }

  async function speak(text = SPOKEN) {
    // The say/paste screen is the entry point now — no card to click first.
    renderFlow()
    await userEvent.type(screen.getByRole('textbox'), text)
    await userEvent.click(screen.getByRole('button', { name: /sort this out/i }))
  }

  it('splits run-on speech the local parser cannot', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.ingredients.map((i) => i.name)).toEqual([
      'tamarind',
      'ginger',
      'kangkong',
    ])
  })

  it('keeps an amount in the words it was said in', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    const ginger = lastProps.initialValues.ingredients.find((i) => i.name === 'ginger')
    expect(ginger.quantity).toBe('about a thumb')
  })

  it('puts a remark about a step into that step’s note', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.steps[1]).toMatchObject({
      content: 'Add the tamarind',
      voice_note: "don't overcook the greens",
    })
  })

  it('fills the extras it heard, and seeds the source field with the person it came from', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues).toMatchObject({
      name: 'Sinigang',
      servings: '4',
      cuisine: 'Filipino',
      description: 'Sour pork soup.',
      sourceName: 'Lola',
    })
    // The seeded source name appears in the form's own field.
    expect(screen.getByDisplayValue('Lola')).toBeInTheDocument()
  })

  it('does not claim to have guessed when the model did the work', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    expect(await screen.findByText(/sorted out what you said/i)).toBeInTheDocument()
    expect(screen.queryByText(/as best we could/i)).toBeNull()
  })

  it('falls back to the local parser when the model is unavailable', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: { ai: false } })
    await speak(TIDY)
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.name).toBe('Adobo')
    expect(screen.getByText(/as best we could/i)).toBeInTheDocument()
  })

  it('falls back silently when the request itself throws', async () => {
    parseRecipeWithAI.mockRejectedValue(new Error('offline'))
    await speak(TIDY)
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.name).toBe('Adobo')
    expect(document.querySelector('.error-pill')).toBeNull()
  })

  it('falls back when the model returns nothing usable', async () => {
    parseRecipeWithAI.mockResolvedValue({
      data: { ai: true, name: '', ingredients: [], steps: [] },
    })
    await speak(TIDY)
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.ingredients).toHaveLength(1)
  })

  it('still saves nothing until the form is submitted', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(plantRecipe).not.toHaveBeenCalled()
  })
})
