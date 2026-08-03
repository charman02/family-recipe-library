import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Only the axios instance is stubbed. `toUserMessage` stays REAL — it is the thing
// under test in the error cases, and mocking it would let the [object Object] bug
// back in while this suite stayed green.
vi.mock('../api/client', async () => ({
  ...(await vi.importActual('../api/client')),
  default: { post: vi.fn() },
}))
import client from '../api/client'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
import Feedback from './Feedback'

function renderFeedback() {
  return render(
    <MemoryRouter>
      <Feedback />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  mockNavigate.mockClear()
  client.post.mockReset()
})

describe('Feedback form', () => {
  it('sends the note to the API', async () => {
    client.post.mockResolvedValue({ data: { id: 1 } })
    renderFeedback()
    await userEvent.type(
      screen.getByLabelText(/your note/i),
      'The save button did nothing',
    )
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    await waitFor(() => expect(client.post).toHaveBeenCalled())
    const [url, payload] = client.post.mock.calls[0]
    expect(url).toBe('/feedback')
    expect(payload.body).toBe('The save button did nothing')
  })

  it('sends null rather than "undefined" when no app version is configured', async () => {
    // An invented version string is worse than an absent one — it would send
    // whoever reads the report looking for a build that never existed.
    client.post.mockResolvedValue({ data: { id: 1 } })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'hi')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    await waitFor(() => expect(client.post).toHaveBeenCalled())
    expect(client.post.mock.calls[0][1].app_version).toBeNull()
  })

  it('CONFIRMS a successful send instead of silently succeeding', async () => {
    // The point of the whole screen: a form that appears to do nothing on submit
    // teaches people their note went nowhere, and they stop sending them.
    client.post.mockResolvedValue({ data: { id: 1 } })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'something broke')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    expect(await screen.findByText(/got it — thank you/i)).toBeInTheDocument()
    expect(screen.getByText(/your note is saved/i)).toBeInTheDocument()
    // And the confirmation is announced, not merely drawn: this view replaces the
    // form outright, so without a live region a screen reader user gets no signal.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('offers a way to send another note after one lands', async () => {
    client.post.mockResolvedValue({ data: { id: 1 } })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'first thing')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))
    await screen.findByText(/got it — thank you/i)

    await userEvent.click(screen.getByRole('button', { name: /send another note/i }))
    // Returns to an EMPTY box — a second note must not start with the first one's
    // text already in it.
    expect(screen.getByLabelText(/your note/i)).toHaveValue('')
  })

  it('refuses a whitespace-only note without a round trip', async () => {
    // Mirrors the server's rule (trim, then require a character). A spacebar-only
    // note satisfies a browser's `required` and arrives as nothing.
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), '   ')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    expect(await screen.findByText(/add a few words first/i)).toBeInTheDocument()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('routes a 422 through toUserMessage, never rendering [object Object]', async () => {
    // FastAPI answers a schema failure with `detail` as an ARRAY OF OBJECTS. This
    // is the shape that white-screened the login page once.
    client.post.mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            {
              loc: ['body', 'body'],
              msg: 'String should have at most 2000 characters',
            },
          ],
        },
      },
    })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'a long note')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toContain('[object Object]')
    expect(alert.textContent).toMatch(/2000 characters/i)
  })

  it('reports a dead connection as a connection problem', async () => {
    // No `response` at all: offline/DNS/timeout. Blaming the note itself would
    // send someone retyping something that was never the problem.
    client.post.mockRejectedValue({ message: 'Network Error' })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'hello')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    expect(await screen.findByText(/couldn't reach issei/i)).toBeInTheDocument()
  })

  it('does not strand the note when the send fails — the text stays put', async () => {
    client.post.mockRejectedValue({ response: { status: 500, data: {} } })
    renderFeedback()
    await userEvent.type(screen.getByLabelText(/your note/i), 'my careful report')
    await userEvent.click(screen.getByRole('button', { name: /send note/i }))

    await screen.findByRole('alert')
    // Still editable and still there, so a failed send costs a tap, not the note.
    expect(screen.getByLabelText(/your note/i)).toHaveValue('my careful report')
  })

  it('discloses exactly what is sent besides the words', async () => {
    // The extra fields are only acceptable because the form says what they are.
    // If this line is ever dropped, the capture becomes a surprise.
    renderFeedback()
    expect(
      screen.getByText(/sent with your note: your account, the screen you came from/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/nothing else/i)).toBeInTheDocument()
  })

  it('gives the textarea a real label, not just a placeholder', async () => {
    // A placeholder disappears on the first keystroke and is not an accessible
    // name — the field has to be reachable and identifiable without it.
    renderFeedback()
    const box = screen.getByLabelText(/your note/i)
    expect(box.tagName).toBe('TEXTAREA')
    expect(box).not.toHaveClass('hidden')
  })

  it('keeps the character counter hidden until the note is actually long', async () => {
    // A counter on an empty box reads as a minimum length and makes a one-line
    // report feel insufficient.
    renderFeedback()
    expect(screen.queryByText(/characters left/i)).toBeNull()
  })

  it('counts down in words once the note approaches the cap', async () => {
    // Words, not a colour change: state is never signalled by colour alone here.
    renderFeedback()
    const box = screen.getByLabelText(/your note/i)
    // fireEvent-style direct set — typing 1800 characters is needlessly slow.
    await userEvent.click(box)
    await userEvent.paste('x'.repeat(1900))
    expect(await screen.findByText(/100 characters left/i)).toBeInTheDocument()
  })

  it('caps the field at the same length the backend enforces', async () => {
    // Kept in lockstep with the schema's 2000 on purpose: a looser field would
    // let someone type a long report and only then have it rejected on send.
    renderFeedback()
    expect(screen.getByLabelText(/your note/i)).toHaveAttribute('maxLength', '2000')
  })
})
