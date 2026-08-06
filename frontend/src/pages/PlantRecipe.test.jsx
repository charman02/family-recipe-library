import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  // Unavailable by default, so every existing paste test exercises the LOCAL parser
  // fallback — which is the path that has to keep working when the model is down.
  parseRecipeWithAI: vi.fn(() => Promise.resolve({ data: { ai: false } })),
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
      onQuickSave,
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
        {onQuickSave && (
          <button onClick={() => onQuickSave('Congee')}>quick-save</button>
        )}
      </div>
    )
  },
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

// PASTE — the second door. It exists because the form asks for 19 fields when only the
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
    renderFlow()
    await userEvent.click(
      screen.getByRole('button', { name: /paste the whole thing/i }),
    )
  }

  async function paste(text) {
    await openPaste()
    await userEvent.type(screen.getByRole('textbox'), text)
    await userEvent.click(screen.getByRole('button', { name: /sort this out/i }))
  }

  it('offers pasting SECOND, after the two origin doors', async () => {
    // The origin doors ask the question this app is about (whose dish is this?), and
    // pasting doesn't answer it — so the shortcut must not outrank them.
    renderFlow()
    const shortcut = screen.getByRole('button', { name: /paste the whole thing/i })
    const own = screen.getByRole('button', { name: /one of your own/i })
    // 4 === Node.DOCUMENT_POSITION_FOLLOWING
    expect(own.compareDocumentPosition(shortcut) & 4).toBeTruthy()
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
    // The button stays disabled below two lines, so there's no path to the form with
    // nothing in it. A SECOND line of any kind is real content: "Adobo / something"
    // parses to one step, which is a terse but legitimate recipe and is let through.
    await openPaste()
    await userEvent.type(screen.getByRole('textbox'), 'Adobo')
    expect(screen.getByRole('button', { name: /sort this out/i })).toBeDisabled()
    expect(plantRecipe).not.toHaveBeenCalled()
  })

  it('saves nothing until the form is submitted', async () => {
    // The parser is allowed to be wrong, so it must not be allowed to write.
    await paste(GUESSED)
    expect(plantRecipe).not.toHaveBeenCalled()
  })

  it('goes back to the paste box from the form, keeping the text', async () => {
    // Correcting the source text has to be possible without re-pasting it.
    await paste(GUESSED)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('textbox')).toHaveValue(GUESSED)
  })
})

// NAME-ONLY SAVE — the escape hatch for the failure testers described: one abandoned
// the form mid-way, and abandoning meant losing everything typed.
describe('PlantRecipe — keeping just the name', () => {
  it('saves with the dish name alone', async () => {
    renderFlow()
    await enterDoor(/one of your own/i)
    await userEvent.click(screen.getByRole('button', { name: /quick-save/i }))
    expect(plantRecipe).toHaveBeenCalledWith({
      name: 'Congee',
      visibility: 'private',
    })
    expect(await screen.findByText('Congee is saved.')).toBeInTheDocument()
  })

  it('keeps the origin even when nothing else is filled in', async () => {
    // "Lola's" is worth keeping on its own — it's the byline the whole app is built
    // around, and on the inherited path it's already been entered by this point.
    renderFlow()
    await enterDoor(/passed down to you/i)
    await userEvent.type(screen.getByLabelText(/their name/i), 'Lola Remedios')
    await userEvent.click(screen.getByRole('button', { name: /quick-save/i }))
    expect(plantRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Congee',
        origin: expect.objectContaining({ name: 'Lola Remedios' }),
      }),
    )
  })

  it('does not tell you to cook a recipe with no steps', async () => {
    renderFlow()
    await enterDoor(/one of your own/i)
    await userEvent.click(screen.getByRole('button', { name: /quick-save/i }))
    await screen.findByText('Congee is saved.')
    expect(screen.queryByText(/cook it/i)).toBeNull()
    expect(screen.getByText(/add the rest whenever you like/i)).toBeInTheDocument()
  })

  it('still says "cook it" after a full save', async () => {
    // The confirmation keys off HOW it was saved, not off the response's shape — the
    // mocked response carries no steps either way, and conflating the two broke this.
    renderFlow()
    await enterDoor(/one of your own/i)
    await userEvent.click(screen.getByRole('button', { name: /submit-form/i }))
    await screen.findByText('Congee is saved.')
    expect(screen.getByText(/cook it/i)).toBeInTheDocument()
  })
})

// The third door. Verifies the PAGE's wiring; GuidedRecipe.test.jsx covers the flow.
describe('PlantRecipe — the guided door', () => {
  it('offers all three ways in', async () => {
    renderFlow()
    for (const name of [
      /passed down to you/i,
      /one of your own/i,
      /paste the whole thing/i,
      /ask me one thing at a time/i,
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('is reachable straight from the doorway, without choosing an origin first', async () => {
    // It asks whose the dish is itself, so it doesn't need a door chosen — and a first
    // version that depended on originMode silently dropped attribution when entered
    // this way.
    renderFlow()
    await userEvent.click(
      screen.getByRole('button', { name: /ask me one thing at a time/i }),
    )
    expect(screen.getByText(/what did you make/i)).toBeInTheDocument()
  })

  it('back from the guided flow returns to the doorway, not out of the app', async () => {
    renderFlow()
    await userEvent.click(
      screen.getByRole('button', { name: /ask me one thing at a time/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText(/where does this/i)).toBeInTheDocument()
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
    renderFlow()
    await userEvent.click(
      screen.getByRole('button', { name: /paste the whole thing/i }),
    )
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
    // The one thing that would make this feature worse than nothing: "about a thumb"
    // coming back as "15 g". The server re-types every amount with the app's own
    // classifier, and the words pass through untouched.
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    const ginger = lastProps.initialValues.ingredients.find((i) => i.name === 'ginger')
    expect(ginger.quantity).toBe('about a thumb')
  })

  it('puts a remark about a step into that step’s note', async () => {
    // voice_note exists precisely for the thing an ingredient list can't hold. Folding
    // it into the step text would lose the distinction the app is built on.
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.steps[1]).toMatchObject({
      content: 'Add the tamarind',
      voice_note: "don't overcook the greens",
    })
  })

  it('fills the extras it heard, and the person it came from', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues).toMatchObject({
      name: 'Sinigang',
      servings: '4',
      cuisine: 'Filipino',
      description: 'Sour pork soup.',
    })
    // Attribution reaches the SourceFields the inherited door uses, not a second path.
    expect(screen.getByDisplayValue('Lola')).toBeInTheDocument()
  })

  it('does not claim to have guessed when the model did the work', async () => {
    parseRecipeWithAI.mockResolvedValue({ data: AI_ANSWER })
    await speak()
    expect(await screen.findByText(/sorted out what you said/i)).toBeInTheDocument()
    expect(screen.queryByText(/as best we could/i)).toBeNull()
  })

  it('falls back to the local parser when the model is unavailable', async () => {
    // ai:false covers a missing key, a rate limit, a timeout and malformed JSON. The
    // door has to keep working — this is the difference between a feature and a
    // dependency.
    parseRecipeWithAI.mockResolvedValue({ data: { ai: false } })
    await speak(TIDY)
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.name).toBe('Adobo')
    expect(screen.getByText(/as best we could/i)).toBeInTheDocument()
  })

  it('falls back silently when the request itself throws', async () => {
    // Offline, 500, DNS failure. The user must not see a stack of red — the local
    // parser produces something usable and the flow continues.
    parseRecipeWithAI.mockRejectedValue(new Error('offline'))
    await speak(TIDY)
    await waitFor(() => expect(lastProps).not.toBeNull())
    expect(lastProps.initialValues.name).toBe('Adobo')
    // No error surface at all: checked by the app's own error styling rather than by
    // matching words, since "wrong" appears in the form's ordinary copy.
    expect(document.querySelector('.error-pill')).toBeNull()
  })

  it('falls back when the model returns nothing usable', async () => {
    // ai:true but empty is a model that answered without finding a recipe. Trusting it
    // would drop someone into a blank form having lost their text.
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
