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
    fireEvent.change(screen.getAllByPlaceholderText('Describe this step…')[0], {
      target: { value: 'Brown the meat' },
    })
    fireEvent.change(
      screen.getAllByPlaceholderText('“don\'t rush the onions”')[0],
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
    fireEvent.change(screen.getAllByPlaceholderText('Describe this step…')[0], {
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

// The add flow's friction fixes. Each of these is a specific reported failure
// from user testing, not a hypothetical.
describe('RecipeForm capture friction', () => {
  it('starts an ADD with several blank rows so the list shape is visible', () => {
    // A tester typed their entire method into step 1 and every ingredient into
    // ingredient 1, because one empty box gave no hint they were meant to be
    // separate entries. Seeing the shape before typing is the fix.
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    expect(screen.getAllByPlaceholderText(/describe this step/i).length).toBe(3)
    expect(screen.getAllByPlaceholderText(/e\.g\. soy sauce/i).length).toBe(3)
    expect(screen.getByText(/one step per box/i)).toBeInTheDocument()
  })

  it('does NOT pad blank rows when editing an existing recipe', () => {
    // Editing must show exactly what's saved — inventing empty rows would read
    // as data the user didn't write.
    render(
      <RecipeForm
        mode="edit"
        initialValues={{
          steps: [{ content: 'Brown the chicken.', voice_note: '' }],
          ingredients: [{ name: 'soy sauce', quantity: '3 soup spoons' }],
        }}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getAllByPlaceholderText(/describe this step/i).length).toBe(1)
    expect(screen.getAllByPlaceholderText(/e\.g\. soy sauce/i).length).toBe(1)
  })

  it('drops the blank padding rows from the payload', async () => {
    // Padding must cost nothing: three empty boxes must not become three empty
    // steps on the saved recipe.
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RecipeForm mode="add" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByPlaceholderText(/“Adobo”/i), {
      target: { value: 'Adobo' },
    })
    fireEvent.change(screen.getAllByPlaceholderText(/describe this step/i)[0], {
      target: { value: 'Brown the chicken.' },
    })
    fireEvent.change(screen.getAllByPlaceholderText(/e\.g\. soy sauce/i)[0], {
      target: { value: 'soy sauce' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /keep this recipe/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.steps).toHaveLength(1)
    expect(payload.ingredients).toHaveLength(1)
    expect(payload.steps[0].position).toBe(1)
  })

  it('Enter in a step opens and focuses the next one', () => {
    // Testers found the TAPPING more tiring than the typing, so a whole list
    // should be enterable from the keyboard without reaching for "+ Add".
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const stepFields = screen.getAllByPlaceholderText(/describe this step/i)
    stepFields[0].focus()
    fireEvent.keyDown(stepFields[0], { key: 'Enter' })
    expect(screen.getAllByPlaceholderText(/describe this step/i)[1]).toHaveFocus()
  })

  it('Enter on the LAST step adds a new one', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const before = screen.getAllByPlaceholderText(/describe this step/i)
    fireEvent.keyDown(before[before.length - 1], { key: 'Enter' })
    expect(screen.getAllByPlaceholderText(/describe this step/i).length).toBe(
      before.length + 1,
    )
  })

  it('Shift+Enter in a step does NOT advance — a step can run long', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const stepFields = screen.getAllByPlaceholderText(/describe this step/i)
    stepFields[0].focus()
    fireEvent.keyDown(stepFields[0], { key: 'Enter', shiftKey: true })
    expect(stepFields[0]).toHaveFocus()
    expect(screen.getAllByPlaceholderText(/describe this step/i).length).toBe(3)
  })

  it('Enter moves name → amount within an ingredient row, not to the next row', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const names = screen.getAllByPlaceholderText(/e\.g\. soy sauce/i)
    names[0].focus()
    fireEvent.keyDown(names[0], { key: 'Enter' })
    expect(
      screen.getAllByPlaceholderText(/1\/2 cup · a dash · to taste/i)[0],
    ).toHaveFocus()
  })

  it('Enter on an amount advances to the next ingredient', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    const amounts = screen.getAllByPlaceholderText(
      /1\/2 cup · a dash · to taste/i,
    )
    fireEvent.keyDown(amounts[0], { key: 'Enter' })
    expect(screen.getAllByPlaceholderText(/e\.g\. soy sauce/i)[1]).toHaveFocus()
  })
})

describe('RecipeForm story prompt', () => {
  it('asks about the person who taught you on the inherited path', () => {
    render(<RecipeForm mode="add" storyVariant="inherited" onSubmit={() => {}} />)
    expect(screen.getByText(/their story \(optional\)/i)).toBeInTheDocument()
    expect(screen.getByText(/who taught you/i)).toBeInTheDocument()
  })

  it('never says "who taught you" when the recipe starts with the user', () => {
    // Asking a self-authored cook who taught them is the kind of thing that makes
    // the app feel like it isn't listening — testers noticed.
    render(<RecipeForm mode="add" storyVariant="own" onSubmit={() => {}} />)
    expect(screen.getByText(/what makes it yours \(optional\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/who taught you/i)).not.toBeInTheDocument()
  })

  it('marks the story optional so nobody stalls on it', () => {
    render(<RecipeForm mode="add" onSubmit={() => {}} />)
    expect(screen.getByText(/their story \(optional\)/i)).toBeInTheDocument()
  })
})
