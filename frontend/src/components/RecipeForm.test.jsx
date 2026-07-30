import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import client from '../api/client'
import RecipeForm from './RecipeForm'

vi.mock('../api/client', () => ({ default: { post: vi.fn() } }))

// A JPEG the size validator accepts, for driving the file input.
function jpeg(name) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function pick(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

// Hands back a post() whose calls resolve only when you say so, so a test can
// land two uploads in whatever order it likes.
function deferredUploads() {
  const pending = []
  client.post.mockImplementation(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  )
  return pending
}

describe('RecipeForm slots', () => {
  it('renders a custom submit label and beforeSubmitSlot', () => {
    render(
      <RecipeForm
        mode="edit"
        submitLabel="Make it mine"
        beforeSubmitSlot={<div>slot-here</div>}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByText('slot-here')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /make it mine/i }),
    ).toBeInTheDocument()
  })

  it('falls back to the default label when submitLabel is not provided', () => {
    render(<RecipeForm mode="edit" onSubmit={() => {}} />)
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument()
  })

  it('uses the add-mode default label when no submitLabel and mode is add', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    expect(
      screen.getByRole('button', { name: /keep this recipe/i }),
    ).toBeInTheDocument()
  })
})

describe('RecipeForm voice-notes', () => {
  it('sends a per-step voice_note in the submitted payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RecipeForm mode="add" onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. “Adobo”'), {
      target: { value: 'Adobo' },
    })
    fireEvent.change(screen.getByPlaceholderText('Describe this step…'), {
      target: { value: 'Brown the meat' },
    })
    fireEvent.change(
      screen.getByPlaceholderText('“don\'t rush the onions”'),
      { target: { value: "don't rush the onions" } },
    )

    fireEvent.click(screen.getByRole('button', { name: /keep this recipe/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.steps[0]).toMatchObject({
      content: 'Brown the meat',
      voice_note: "don't rush the onions",
    })
  })

  it('nulls an empty voice_note in the payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RecipeForm mode="add" onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. “Adobo”'), {
      target: { value: 'Adobo' },
    })
    fireEvent.change(screen.getByPlaceholderText('Describe this step…'), {
      target: { value: 'Brown the meat' },
    })

    fireEvent.click(screen.getByRole('button', { name: /keep this recipe/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.steps[0].voice_note).toBeNull()
  })
})

describe('RecipeForm cover photo', () => {
  it('offers a keyboard-reachable file input in the empty state', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const input = screen.getByLabelText('Add a cover photo')
    expect(input).toHaveAttribute('type', 'file')
    // Regression guard: the input used to be `hidden` (display:none), which
    // drops it out of the tab order and made the photo step unreachable by
    // keyboard. It must stay visually-hidden-but-focusable instead.
    expect(input).toHaveClass('sr-only')
    expect(screen.getByText('Add a photo')).toBeInTheDocument()
  })

  it('shows the chosen cover with a remove control instead of the picker', () => {
    render(
      <RecipeForm
        mode="edit"
        initialValues={{ coverPhotoUrl: 'https://img.test/adobo.jpg' }}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByAltText('Recipe cover')).toHaveAttribute(
      'src',
      'https://img.test/adobo.jpg',
    )
    expect(
      screen.getByRole('button', { name: /remove photo/i }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Add a cover photo')).not.toBeInTheDocument()
  })
})

describe('RecipeForm cover photo — concurrent uploads', () => {
  beforeEach(() => {
    client.post.mockReset()
  })

  it('keeps the last pick when responses land out of order', async () => {
    const pending = deferredUploads()
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const input = screen.getByLabelText('Add a cover photo')

    // Pick A, then pick B before A's upload has answered.
    pick(input, jpeg('a.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    pick(input, jpeg('b.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2))

    // B answers first, then A — A is the stale winner in the original bug.
    pending[1].resolve({ data: { url: 'https://img.test/b.jpg' } })
    await waitFor(() =>
      expect(screen.getByAltText('Recipe cover')).toHaveAttribute(
        'src',
        'https://img.test/b.jpg',
      ),
    )
    // act(async) flushes A's continuation, so the assertion below can't pass
    // merely by running before the stale response was processed.
    await act(async () => {
      pending[0].resolve({ data: { url: 'https://img.test/a.jpg' } })
    })

    // A must never overwrite B: the user's most recent choice is the cover.
    expect(screen.getByAltText('Recipe cover')).toHaveAttribute(
      'src',
      'https://img.test/b.jpg',
    )
  })

  it('keeps the picker usable while an upload is in flight', async () => {
    deferredUploads()
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const input = screen.getByLabelText('Add a cover photo')

    pick(input, jpeg('a.jpg'))
    await waitFor(() => expect(screen.getByText('Uploading…')).toBeTruthy())
    // A slow connection must not trap the user behind a disabled input that
    // looks stuck — picking again has to remain possible.
    expect(input).not.toBeDisabled()
  })

  it('aborts the superseded request when a second photo is picked', async () => {
    deferredUploads()
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const input = screen.getByLabelText('Add a cover photo')

    pick(input, jpeg('a.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    pick(input, jpeg('b.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2))

    expect(client.post.mock.calls[0][2].signal.aborted).toBe(true)
    expect(client.post.mock.calls[1][2].signal.aborted).toBe(false)
  })

  it('does not surface the superseded upload as an error', async () => {
    const pending = deferredUploads()
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const input = screen.getByLabelText('Add a cover photo')

    pick(input, jpeg('a.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    pick(input, jpeg('b.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2))

    // The aborted first request rejects; that's expected, not a user failure.
    pending[0].reject(new Error('canceled'))
    pending[1].resolve({ data: { url: 'https://img.test/b.jpg' } })

    await waitFor(() =>
      expect(screen.getByAltText('Recipe cover')).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/photo upload failed/i),
    ).not.toBeInTheDocument()
  })

  it('replaces an existing cover with the newly uploaded photo', async () => {
    const pending = deferredUploads()
    render(
      <RecipeForm
        mode="edit"
        initialValues={{ coverPhotoUrl: 'https://img.test/old.jpg' }}
        onSubmit={() => {}}
      />,
    )

    // Removing the saved cover exposes the picker; the old URL stays in
    // Cloudinary by design (see removePhoto).
    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }))
    pick(screen.getByLabelText('Add a cover photo'), jpeg('new.jpg'))
    await waitFor(() => expect(client.post).toHaveBeenCalledTimes(1))
    pending[0].resolve({ data: { url: 'https://img.test/new.jpg' } })

    await waitFor(() =>
      expect(screen.getByAltText('Recipe cover')).toHaveAttribute(
        'src',
        'https://img.test/new.jpg',
      ),
    )
  })
})

describe('RecipeForm intro', () => {
  it('renders the intro node under the heading when provided', () => {
    render(
      <RecipeForm
        mode="add"
        intro={<p>splash-of-vinegar-framing</p>}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByText('splash-of-vinegar-framing')).toBeInTheDocument()
  })

  it('renders no intro by default (Edit/Remix reuse stays clean)', () => {
    render(<RecipeForm mode="edit" onSubmit={() => {}} />)
    expect(
      screen.queryByText('splash-of-vinegar-framing'),
    ).not.toBeInTheDocument()
  })
})
