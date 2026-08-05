import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// BackButton reads useNavigate, so the flow needs a router even though it doesn't
// navigate itself — it reports Back to its parent instead.
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
import client from '../api/client'
import GuidedRecipe from './GuidedRecipe'

beforeEach(() => {
  client.get.mockReset()
  client.get.mockResolvedValue({ data: { names: [] } })
})

const onDone = vi.fn(() => Promise.resolve())
const onBack = vi.fn()

function open() {
  onDone.mockClear()
  onBack.mockClear()
  return render(
    <MemoryRouter>
      <GuidedRecipe onDone={onDone} onBack={onBack} />
    </MemoryRouter>,
  )
}

const type = (el, text) => userEvent.type(el, text)
const next = () => userEvent.click(screen.getByRole('button', { name: /^Next/ }))

async function toIngredients(dish = 'Kare-Kare') {
  open()
  await type(screen.getByPlaceholderText(/adobo/i), dish)
  await next()
  await userEvent.click(screen.getByRole('button', { name: /my own recipe/i }))
}

async function addIngredient(name, amount) {
  await type(screen.getByPlaceholderText(/soy sauce/i), name)
  if (amount) await type(screen.getByPlaceholderText(/a dash/i), amount)
  await userEvent.click(screen.getByRole('button', { name: /next ingredient/i }))
}

describe('GuidedRecipe — one question at a time', () => {
  it('asks for the dish first and will not advance without it', async () => {
    open()
    expect(screen.getByRole('button', { name: /^Next/ })).toBeDisabled()
    await type(screen.getByPlaceholderText(/adobo/i), 'Kare-Kare')
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
  })

  it('always asks whose recipe it is, with a way out', async () => {
    // A first version hid this screen unless the "passed down" door had been chosen,
    // which made the flow unusable on its own: entered straight from the doorway there
    // is no origin mode, so the dish could not be attributed at all — in an app whose
    // whole point is that a recipe comes from a person.
    open()
    await type(screen.getByPlaceholderText(/adobo/i), 'Kare-Kare')
    await next()
    expect(screen.getByText(/whose kare-kare is this/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /my own recipe/i }),
    ).toBeInTheDocument()
  })

  it('collects ingredients in a loop, not on new screens', async () => {
    // The screen count is what makes a wizard tolerable. Ten ingredients must not mean
    // ten screens — testers already abandoned a flow that added steps.
    await toIngredients()
    await addIngredient('oxtail', '1 kg')
    await addIngredient('peanut butter', '3 soup spoons')
    expect(screen.getByText('oxtail')).toBeInTheDocument()
    expect(screen.getByText('peanut butter')).toBeInTheDocument()
    // Still screen 3 of 5.
    expect(screen.getByText('3 of 5')).toBeInTheDocument()
  })

  it('returns to the ingredient field after each one', async () => {
    // Without this the keyboard closes and every extra ingredient costs a tap. An
    // earlier version held a ref that was never attached to an element, so the
    // refocus silently did nothing.
    await toIngredients()
    await addIngredient('oxtail', '1 kg')
    await waitFor(() =>
      expect(document.activeElement?.id).toBe('guided-ingredient'),
    )
  })

  it('lets an ingredient be taken back out', async () => {
    await toIngredients()
    await addIngredient('oxtail', '1 kg')
    await addIngredient('bok choy', 'a bunch')
    await userEvent.click(screen.getByRole('button', { name: /remove oxtail/i }))
    expect(screen.queryByText('oxtail')).toBeNull()
    expect(screen.getByText('bok choy')).toBeInTheDocument()
  })

  it('accepts an ingredient with no amount at all', async () => {
    // "ginger" is a real line in a real recipe. Requiring an amount would force people
    // to invent precision, which is the opposite of what this app is for.
    await toIngredients()
    await addIngredient('ginger', '')
    expect(screen.getByText('ginger')).toBeInTheDocument()
    expect(screen.getByText(/no amount/i)).toBeInTheDocument()
  })
})

describe('GuidedRecipe — never losing what was entered', () => {
  it('offers "done for now" once there is a dish name', async () => {
    // The failure that motivated all of this: someone abandoned the long form midway
    // and lost everything typed.
    open()
    expect(screen.queryByRole('button', { name: /done for now/i })).toBeNull()
    await type(screen.getByPlaceholderText(/adobo/i), 'Kare-Kare')
    await next()
    expect(
      screen.getByRole('button', { name: /done for now/i }),
    ).toBeInTheDocument()
  })

  it('saves partway through, keeping what exists', async () => {
    await toIngredients()
    await addIngredient('oxtail', '1 kg')
    await userEvent.click(screen.getByRole('button', { name: /done for now/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.name).toBe('Kare-Kare')
    expect(payload.ingredients).toHaveLength(1)
    expect(payload.steps).toHaveLength(0)
  })

  it('flushes a typed-but-unconfirmed row rather than dropping it', async () => {
    // Typing an ingredient and then tapping "done for now" without confirming it is a
    // completely reasonable thing to do, and silently discarding it would be the same
    // data loss this flow exists to prevent.
    await toIngredients()
    await type(screen.getByPlaceholderText(/soy sauce/i), 'annatto')
    await userEvent.click(screen.getByRole('button', { name: /done for now/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone.mock.calls[0][0].ingredients[0].name).toBe('annatto')
  })

  it('preserves imprecision through to the payload', async () => {
    // The whole product rests on this: a folk amount must arrive typed imprecise with
    // its words intact, never converted.
    await toIngredients()
    await addIngredient('peanut butter', '3 soup spoons')
    await userEvent.click(screen.getByRole('button', { name: /done for now/i }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone.mock.calls[0][0].ingredients[0]).toMatchObject({
      name: 'peanut butter',
      quantity_text: '3 soup spoons',
      quantity_type: 'imprecise',
    })
  })
})

describe('GuidedRecipe — moving around', () => {
  it('back from the first screen leaves the flow', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('back from a later screen returns to the previous question, keeping answers', async () => {
    open()
    await type(screen.getByPlaceholderText(/adobo/i), 'Kare-Kare')
    await next()
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByPlaceholderText(/adobo/i)).toHaveValue('Kare-Kare')
    expect(onBack).not.toHaveBeenCalled()
  })

  it('reaches a summary that reads back what was collected', async () => {
    await toIngredients()
    await addIngredient('oxtail', '1 kg')
    await userEvent.click(screen.getByRole('button', { name: /that's everything/i }))
    await type(screen.getByPlaceholderText(/step 1/i), 'Simmer it')
    await userEvent.click(screen.getByRole('button', { name: /next step/i }))
    await userEvent.click(
      screen.getByRole('button', { name: /that's the last step/i }),
    )
    expect(screen.getByText('Kare-Kare')).toBeInTheDocument()
    expect(screen.getByText(/1 ingredient · 1 step/)).toBeInTheDocument()
  })
})
