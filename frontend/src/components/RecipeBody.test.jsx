import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeBody from './RecipeBody'

const base = {
  name: 'Adobo',
  cover_photo_url: null,
  story: 'Her Sunday dish.',
  ingredients: [
    { name: 'Chicken', quantity_text: '2 lbs', quantity_type: 'precise', position: 1 },
    { name: 'Vinegar', quantity_text: 'a good splash', quantity_type: 'imprecise', position: 2 },
  ],
  ingredient_sections: [],
  steps: [
    { content: 'Brown the chicken.', position: 1 },
    { content: 'Add vinegar.', position: 2 },
  ],
}

describe('RecipeBody', () => {
  it('tags imprecise amounts "their way" but not precise ones', () => {
    const { getAllByText, getByText } = render(<RecipeBody recipe={base} />)
    expect(getAllByText(/their way/i).length).toBe(1) // only the imprecise vinegar
    expect(getByText('2 lbs')).toBeTruthy()
  })
  it('renders all steps in order', () => {
    const { getByText } = render(<RecipeBody recipe={base} />)
    expect(getByText('Brown the chicken.')).toBeTruthy()
    expect(getByText('Add vinegar.')).toBeTruthy()
  })
  it('shows the issei. cover fallback when there is no cover photo', () => {
    const { container } = render(<RecipeBody recipe={base} />)
    // CoverImage's no-photo fallback renders the issei. wordmark text
    expect(container.textContent.toLowerCase()).toContain('issei')
  })

  // On a recipient's page the owner fallback misfires twice: it prompts for an
  // upload they can't do, and it prints a second issei. under the invite header's.
  it('drops the wordmark and the photo prompt from the cover in reader context', () => {
    const { container } = render(<RecipeBody recipe={base} context="reader" />)
    expect(container.textContent.toLowerCase()).not.toContain('issei')
    expect(container.textContent).not.toMatch(/brings this dish to life/i)
  })
  it('displays servings and description when present', () => {
    const { getByText } = render(
      <RecipeBody recipe={{ ...base, servings: 4, description: 'A tangy braise.' }} />,
    )
    expect(getByText(/serves 4/i)).toBeTruthy()
    expect(getByText('A tangy braise.')).toBeTruthy()
  })

  // The description answers "what IS this dish?" — the first thing a reader wants
  // and the only thing a recipient who's never tasted it can't work out. It used
  // to render as small muted text jammed on top of the peach story card, which
  // swallowed it; it now reads at full ink and story-comparable size.
  it('gives the description its own presence, not muted caption treatment', () => {
    render(<RecipeBody recipe={{ ...base, description: 'A tangy braise.' }} />)
    const desc = screen.getByText('A tangy braise.')
    expect(desc.className).toContain('text-ink')
    expect(desc.className).not.toContain('text-ink-soft')
    expect(desc.className).toMatch(/text-\[17px\]/)
  })

  // The story and step notes are the only surfaces where a PERSON is speaking.
  // They're set apart structurally, NOT by a handwriting font — five were tried
  // and cut, because this is content someone cooks from and the data is typed
  // text. This pins that they stay visually distinct from the instructions
  // without reaching for a script face again.
  it('sets a person’s words apart without a handwriting font', () => {
    render(
      <RecipeBody
        recipe={{
          ...base,
          steps: [{ content: 'Brown it.', position: 1, voice_note: 'go slow' }],
        }}
      />,
    )
    const story = screen.getByText('Her Sunday dish.')
    const remark = screen.getByText('go slow')
    // No script face anywhere.
    expect(story.className).not.toContain('font-hand')
    expect(remark.className).not.toContain('font-hand')
    // Still the app's display serif, and the story stays italic so it reads as
    // someone speaking rather than as another instruction.
    expect(story.className).toContain('font-display')
    expect(story.className).toContain('italic')
    expect(remark.className).toContain('font-display')
  })

  // --- copy that user testing showed was undecodable ---

  it('labels a step remark "a note on this step", never implying a recording', () => {
    render(
      <RecipeBody
        recipe={{
          ...base,
          steps: [
            { content: 'Brown the chicken.', position: 1, voice_note: 'don’t rush it' },
          ],
        }}
      />,
    )
    expect(screen.getByText(/a note on this step/i)).toBeInTheDocument()
    expect(screen.getByText('don’t rush it')).toBeInTheDocument()
    // voice_note is plain text typed by the recorder — no audio exists in the app.
    expect(screen.queryByText(/their words/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|listen|voice/i)).not.toBeInTheDocument()
  })

  // Both labels must name what the view CONTAINS ("Cooking mode" told testers
  // nothing) AND be true of it. "Just the steps" failed the second test: the
  // cooking view keeps the ingredients, so the label named less than it showed.
  it('labels each view by the lists it shows, with no explanatory sub-line', async () => {
    render(<RecipeBody recipe={base} />)
    expect(screen.getByRole('button', { name: /full recipe/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ingredients & steps/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /just the steps/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cooking mode/i })).toBeNull()
    // The labels carry the meaning alone now — the descriptor line was clutter.
    expect(screen.queryByText(/everything: the photo, the story/i)).toBeNull()
    expect(screen.queryByText(/easy to follow while you cook/i)).toBeNull()
  })

  it('the cooking view really does keep the ingredients, as its label claims', async () => {
    render(<RecipeBody recipe={base} />)
    await userEvent.click(
      screen.getByRole('button', { name: /ingredients & steps/i }),
    )
    expect(screen.getByText('Ingredients')).toBeInTheDocument()
    expect(screen.getByText('Chicken')).toBeInTheDocument()
    expect(screen.getByText('Brown the chicken.')).toBeInTheDocument()
    // ...and drops what it claims to drop: photo, story, per-step notes.
    expect(screen.queryByText(/Her Sunday dish\./)).toBeNull()
    expect(screen.queryByText(/a note on this step/i)).toBeNull()
  })

  it('shows the bare author name when there is no recorded origin (no "kept by")', () => {
    render(<RecipeBody recipe={{ ...base, author_full_name: 'Yoko M.' }} />)
    expect(screen.getByText('Yoko M.')).toBeInTheDocument()
    expect(screen.queryByText(/kept by/i)).not.toBeInTheDocument()
  })

  it('titles the story with the source’s name without claiming they typed it', () => {
    render(
      <RecipeBody
        recipe={{ ...base, origin_attribution: 'Lola Remedios · Cebu' }}
      />,
    )
    expect(screen.getByText(/Lola Remedios's story/i)).toBeInTheDocument()
    expect(screen.queryByText(/in .*'s words/i)).not.toBeInTheDocument()
  })
})

// Cooking is interleaved: you read a step, work for two minutes, then look back
// and have to find your place. These pin the affordance that solves it — and that
// it's DISCOVERABLE, since a dim-on-tap with no visible control is a feature
// nobody finds.
describe('RecipeBody — cooking from it', () => {
  const withSteps = {
    ...base,
    steps: [
      { id: 1, content: 'Brown the chicken.', position: 1 },
      { id: 2, content: 'Add the vinegar.', position: 2 },
    ],
  }

  it('shows a real checkbox per step, so the affordance is visible', () => {
    // The empty box IS the instruction — nothing has to be explained.
    render(<RecipeBody recipe={withSteps} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    boxes.forEach((b) => expect(b).not.toBeChecked())
  })

  it('names each checkbox by its step, so it works unseen', () => {
    // A screen reader announces the step text, not "checkbox 1 of 2".
    render(<RecipeBody recipe={withSteps} />)
    expect(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    ).toBeInTheDocument()
  })

  it('lets a cook check a step off, and uncheck it', async () => {
    render(<RecipeBody recipe={withSteps} />)
    const box = screen.getByRole('checkbox', { name: /brown the chicken/i })
    await userEvent.click(box)
    expect(box).toBeChecked()
    // Reversible: a mis-tap with wet hands must not be a dead end.
    await userEvent.click(box)
    expect(box).not.toBeChecked()
  })

  it('checks off only the step that was tapped', async () => {
    render(<RecipeBody recipe={withSteps} />)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    expect(
      screen.getByRole('checkbox', { name: /add the vinegar/i }),
    ).not.toBeChecked()
  })

  it('is operable by keyboard, not tap only', async () => {
    render(<RecipeBody recipe={withSteps} />)
    const box = screen.getByRole('checkbox', { name: /brown the chicken/i })
    box.focus()
    await userEvent.keyboard(' ')
    expect(box).toBeChecked()
  })

  it('does not signal done by colour alone', async () => {
    // The checked state is in the DOM for assistive tech, and struck through for
    // anyone who can't distinguish the dimmed text.
    render(<RecipeBody recipe={withSteps} />)
    const box = screen.getByRole('checkbox', { name: /brown the chicken/i })
    await userEvent.click(box)
    expect(box).toBeChecked()
    expect(screen.getByText('Brown the chicken.').className).toContain(
      'line-through',
    )
  })

  it('sets cooking text at a size readable at arm’s length', () => {
    // 14.5px was a desk size. A phone propped on a counter is further away than a
    // phone in your hand, and the reader's hands are busy.
    render(<RecipeBody recipe={withSteps} />)
    expect(screen.getByText('Brown the chicken.').className).toContain(
      'text-[16.5px]',
    )
  })
})

// The numeral IS the checkbox — one control, two meanings. These pin that merge,
// since the obvious regression is reintroducing a second marker (or losing the
// number, which a cook needs to say "I'm on step 3").
describe('RecipeBody — the step numeral is the control', () => {
  const withSteps = {
    ...base,
    steps: [
      { id: 1, content: 'Brown the chicken.', position: 1 },
      { id: 2, content: 'Add the vinegar.', position: 2 },
    ],
  }

  it('shows the step number while the step is unfinished', () => {
    render(<RecipeBody recipe={withSteps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('replaces the number with a visible tick once checked', async () => {
    // Colouring the control in without drawing a tick was the earlier bug: the
    // check has to be *drawn*, not implied by a fill.
    const { container } = render(<RecipeBody recipe={withSteps} />)
    expect(container.querySelectorAll('svg path[d^="M5 12.5"]')).toHaveLength(0)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    expect(container.querySelectorAll('svg path[d^="M5 12.5"]')).toHaveLength(1)
    // ...and that step's number is gone, because the tick took its place.
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not stack a separate checkbox beside the numeral', () => {
    // Two leading markers per row read as clutter and duplicated one job.
    render(<RecipeBody recipe={withSteps} />)
    const row = screen.getByText('Brown the chicken.').closest('label')
    // The only visible control in the row is the numeral itself.
    expect(row.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
    expect(row.querySelector('input').className).toContain('sr-only')
  })
})

// Discoverability is the thing that failed twice here — first a bare tap-to-dim
// with no visible control, then a numeral whose state was colour-only. Both were
// features only the author knew about. These pin BOTH signals that fixed it.
describe('RecipeBody — the check-off is discoverable', () => {
  const withSteps = {
    ...base,
    steps: [
      { id: 1, content: 'Brown the chicken.', position: 1 },
      { id: 2, content: 'Add the vinegar.', position: 2 },
    ],
  }

  it('says outright that the numbers are tappable', () => {
    render(<RecipeBody recipe={withSteps} />)
    expect(screen.getByText(/tap each number as you go to check off steps/i)).toBeInTheDocument()
  })

  it('skips the hint for a single-step recipe, which has no place to lose', () => {
    render(
      <RecipeBody
        recipe={{ ...base, steps: [{ id: 1, content: 'Just cook it.', position: 1 }] }}
      />,
    )
    expect(screen.queryByText(/tap each number as you go to check off steps/i)).not.toBeInTheDocument()
  })

  it('dresses the numeral in the app’s interactive signal — outline + hard shadow', () => {
    // Every other control in this design wears an ink outline and a hard offset
    // shadow, so a disc with both reads as a control on sight. That's what makes
    // the affordance visible without a second element beside the number.
    render(<RecipeBody recipe={withSteps} />)
    const disc = screen.getByText('1')
    expect(disc.className).toContain('border-2')
    expect(disc.className).toContain('border-ink')
    expect(disc.className).toMatch(/shadow-\[0_2px_0/)
  })

  it('presses in when checked, the same way the app’s buttons do', async () => {
    render(<RecipeBody recipe={withSteps} />)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    // The disc is now the tick; find it via the row rather than by text.
    const row = screen.getByText('Brown the chicken.').closest('label')
    const disc = row.querySelector('span[aria-hidden="true"]')
    expect(disc.className).toContain('bg-terra')
    expect(disc.className).toContain('shadow-none')
  })
})
