import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeBody from './RecipeBody'

// The servings stepper calls GET /recipes/{id}/scale via scaleRecipe. Stub it so
// the component is drivable without a backend; each test sets its own resolution.
vi.mock('../api/sharing', () => ({
  scaleRecipe: vi.fn(),
}))
import { scaleRecipe } from '../api/sharing'

beforeEach(() => {
  scaleRecipe.mockReset()
})

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
  // THE NO-PHOTO COVER, third iteration. History, because each version answered a real
  // complaint about the one before it:
  //   1. the `issei.` wordmark + "A photo brings this dish to life" — the copy scolded
  //      an owner and meant nothing to a recipient with no upload button
  //   2. a pull quote from the recipe's own words, set large
  //   3. the mark alone, no copy — what these now assert
  //
  // (2) was replaced because a real user read it wrong, correctly: the developer's
  // mother asked "why are there ingredients on the cover photo?" A photo-shaped frame
  // full of 26px italic type has no cue that it's a pull quote, and this page passed
  // avoid="notes", which made it reach for an imprecise AMOUNT specifically — putting an
  // ingredient line on the cover of the one screen that also shows the ingredient table.
  it('does NOT print recipe text in the cover frame', () => {
    // The direct inversion of the test that used to live here. An amount must appear
    // exactly once on this page — in the ingredient table, where it belongs.
    const { container } = render(
      <RecipeBody
        recipe={{
          ...base,
          ingredients: [
            { id: 1, name: 'garlic', quantity_text: 'a whole head', quantity_type: 'imprecise' },
          ],
        }}
      />,
    )
    const hits = container.textContent.match(/a whole head/g) || []
    expect(hits).toHaveLength(1)
  })

  it('still never begs for a photo', () => {
    // The surviving half of the guard that (2) installed. Mom's feedback moved the
    // wordmark half of it — the mark is back, deliberately — but the anti-scolding rule
    // was right and is untouched: no copy names what's missing, on either surface.
    for (const context of ['owner', 'reader']) {
      const { container, unmount } = render(
        <RecipeBody recipe={base} context={context} />,
      )
      expect(container.textContent).not.toMatch(/brings this dish to life/i)
      expect(container.textContent).not.toMatch(/add a photo/i)
      unmount()
    }
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
    // ...and drops what it claims to drop: cover, story, per-step notes.
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

// A step's saffron note used to stay at full strength after the step was checked
// off, so a finished step still had a bright card hanging off it pulling the eye
// back to work already done. The note has to look finished WITH its step — while
// staying readable, since re-reading a note on a done step ("did I miss
// something?") is exactly when a cook comes back to it.
describe('RecipeBody — a checked step’s note looks finished too', () => {
  const withSteps = {
    ...base,
    steps: [
      { id: 1, content: 'Brown the chicken.', position: 1, voice_note: 'go low and slow' },
      { id: 2, content: 'Add the vinegar.', position: 2, voice_note: 'don’t stir yet' },
    ],
  }

  // The note card is the element wrapping the note text — not the <label>.
  const noteCardFor = (text) => screen.getByText(text).closest('div')

  it('leaves an unchecked step’s note at full strength', () => {
    render(<RecipeBody recipe={withSteps} />)
    const card = noteCardFor('go low and slow')
    expect(card.className).not.toMatch(/opacity-/)
    expect(card.className).toMatch(/shadow-\[0_2px_0/)
  })

  it('fades the whole card, tint and all, once the step is checked', async () => {
    // Dimming only the text would leave the saffron field and its quote stamp
    // bright — the colour is what draws the eye, so the card fades as one piece.
    render(<RecipeBody recipe={withSteps} />)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    const card = noteCardFor('go low and slow')
    expect(card.className).toContain('opacity-60')
    // The tint stays on the element that fades, so stamp + border + fill recede
    // together rather than a grey card wearing a bright saffron stamp.
    expect(card.className).toContain('bg-saffron/20')
  })

  it('stays readable when done — dimmer than full, but well clear of the struck step', async () => {
    // "Finished" must not mean "unusable". The instruction goes to ink/40; the
    // note, a paragraph someone may deliberately re-read, stops well short of it.
    render(<RecipeBody recipe={withSteps} />)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    const card = noteCardFor('go low and slow')
    const opacity = Number(card.className.match(/opacity-(\d+)/)[1])
    expect(opacity).toBeGreaterThanOrEqual(50)
    expect(opacity).toBeLessThan(100)
    // The note text itself keeps full ink and no strikethrough — a struck
    // multi-line paragraph is hard to read, and the done-ness lives on the step.
    const note = screen.getByText('go low and slow')
    expect(note.className).toContain('text-ink')
    expect(note.className).not.toContain('line-through')
  })

  it('does not fade the note by colour alone', async () => {
    // Opacity is a colour cue. The card also drops its hard shadow and presses
    // in, the same geometry as the numeral disc — and the step's own checkbox
    // state and line-through are untouched.
    render(<RecipeBody recipe={withSteps} />)
    const box = screen.getByRole('checkbox', { name: /brown the chicken/i })
    await userEvent.click(box)
    const card = noteCardFor('go low and slow')
    expect(card.className).toContain('shadow-none')
    expect(card.className).toMatch(/translate-y-/)
    expect(box).toBeChecked()
    expect(screen.getByText('Brown the chicken.').className).toContain(
      'line-through',
    )
  })

  it('fades only the note belonging to the step that was checked', async () => {
    render(<RecipeBody recipe={withSteps} />)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    )
    expect(noteCardFor('don’t stir yet').className).not.toMatch(/opacity-/)
  })

  it('un-fades the note when the step is unchecked again', async () => {
    render(<RecipeBody recipe={withSteps} />)
    const box = screen.getByRole('checkbox', { name: /brown the chicken/i })
    await userEvent.click(box)
    expect(noteCardFor('go low and slow').className).toContain('opacity-60')
    await userEvent.click(box)
    expect(noteCardFor('go low and slow').className).not.toMatch(/opacity-/)
  })

  it('keeps the note outside the tap target, so reading it can’t tick the step', async () => {
    // The note card is a SIBLING of the <label>. Clicking into it to read must
    // not toggle the checkbox.
    render(<RecipeBody recipe={withSteps} />)
    const note = screen.getByText('go low and slow')
    expect(note.closest('label')).toBeNull()
    await userEvent.click(note)
    expect(
      screen.getByRole('checkbox', { name: /brown the chicken/i }),
    ).not.toBeChecked()
  })

  it('still renders notes when present and none when absent', async () => {
    // The fade must not have become a condition on rendering at all.
    const { rerender } = render(<RecipeBody recipe={withSteps} />)
    expect(screen.getAllByText(/a note on this step/i)).toHaveLength(2)
    rerender(
      <RecipeBody
        recipe={{ ...base, steps: [{ id: 1, content: 'Just cook it.', position: 1 }] }}
      />,
    )
    expect(screen.queryByText(/a note on this step/i)).toBeNull()
  })
})

// A per-step technique photo. This exists for the reader who has never tasted OR
// seen the dish: "fold the dumpling like this", "until it looks like this" is
// knowledge prose can't carry. The tests that matter most are the two about WHERE
// it shows — the cooking view and the recipient's page — because those are the
// two moments the feature is actually for.
describe('RecipeBody — a step’s technique photo', () => {
  const PHOTO = 'https://img.test/fold.jpg'
  const withPhoto = {
    ...base,
    steps: [
      {
        id: 1,
        content: 'Pleat the wrapper into a half-moon.',
        position: 1,
        photo_url: PHOTO,
        voice_note: 'go slow',
      },
      { id: 2, content: 'Steam for eight minutes.', position: 2 },
    ],
  }

  const photoFor = (n) => screen.queryByAltText(new RegExp(`^Step ${n}:`))

  it('shows the photo under the step it belongs to', () => {
    render(<RecipeBody recipe={withPhoto} />)
    expect(photoFor(1)).toHaveAttribute('src', PHOTO)
  })

  it('shows nothing for a step with no photo', () => {
    render(<RecipeBody recipe={withPhoto} />)
    expect(photoFor(2)).toBeNull()
  })

  it('names the photo by its step, so it is not an unlabelled image', () => {
    // The picture's own content is unknown to us; the step it illustrates is the
    // only honest description, and it's what a screen-reader user needs to place it.
    render(<RecipeBody recipe={withPhoto} />)
    expect(photoFor(1)).toHaveAccessibleName(
      'Step 1: Pleat the wrapper into a half-moon.',
    )
  })

  // THE decision this feature turns on. The cooking view hides the story and the
  // per-step notes because they're prose you read before you start. A technique
  // photo is the opposite: it answers a question that only arises mid-cook, and
  // hiding it here would remove it from the one view people cook from.
  it('KEEPS the photo in the cooking view, unlike the step’s prose note', async () => {
    render(<RecipeBody recipe={withPhoto} />)
    await userEvent.click(
      screen.getByRole('button', { name: /ingredients & steps/i }),
    )
    // The note goes, as before...
    expect(screen.queryByText(/a note on this step/i)).toBeNull()
    // ...and the photo deliberately stays: "is this what it should look like?"
    // is a question you only ask with your hands in the bowl.
    expect(photoFor(1)).toHaveAttribute('src', PHOTO)
  })

  // The recipient of a handoff reads this same component with context="reader"
  // from an invite link and no account. They're the one person who has never seen
  // the dish, so a photo that only worked for the owner would miss its audience.
  it('works on the recipient’s page, where nothing may depend on ownership', () => {
    render(<RecipeBody recipe={withPhoto} context="reader" />)
    expect(photoFor(1)).toHaveAttribute('src', PHOTO)
  })

  it('keeps the photo outside the tap target, so a closer look can’t tick the step', async () => {
    render(<RecipeBody recipe={withPhoto} />)
    const img = photoFor(1)
    expect(img.closest('label')).toBeNull()
    await userEvent.click(img)
    expect(
      screen.getByRole('checkbox', { name: /pleat the wrapper/i }),
    ).not.toBeChecked()
  })

  it('fades and presses in with its step, but stays clearly readable when done', async () => {
    render(<RecipeBody recipe={withPhoto} />)
    expect(photoFor(1).className).not.toMatch(/opacity-/)
    await userEvent.click(
      screen.getByRole('checkbox', { name: /pleat the wrapper/i }),
    )
    const cls = photoFor(1).className
    // Not colour alone: the hard shadow collapses the way the numeral disc's does.
    expect(cls).toContain('shadow-none')
    expect(cls).toMatch(/translate-y-/)
    // A photo is the record of what "done" looks like, so checking your work
    // against it AFTER the step is a real use — it fades less than the note (60).
    const opacity = Number(cls.match(/opacity-(\d+)/)[1])
    expect(opacity).toBeGreaterThan(60)
    expect(opacity).toBeLessThan(100)
  })

  it('un-fades when the step is unchecked again', async () => {
    render(<RecipeBody recipe={withPhoto} />)
    const box = screen.getByRole('checkbox', { name: /pleat the wrapper/i })
    await userEvent.click(box)
    expect(photoFor(1).className).toMatch(/opacity-/)
    await userEvent.click(box)
    expect(photoFor(1).className).not.toMatch(/opacity-/)
  })
})

// SERVINGS STEPPER. The scaling itself is the backend's job (fidelity: folk units
// stay verbatim); this just drives GET /scale and renders what comes back.
describe('RecipeBody — servings stepper', () => {
  const scalable = {
    id: 7,
    name: 'Adobo',
    servings: 4,
    ingredients: [
      { name: 'Chicken', quantity_text: '2 lbs', quantity_type: 'precise', position: 1 },
      { name: 'Water', quantity_text: '3 fingers', quantity_type: 'imprecise', position: 2 },
    ],
    ingredient_sections: [],
    steps: [{ content: 'Brown it.', position: 1 }],
  }

  it('does not show the stepper unless the page opts in (scalable)', () => {
    // The public invite page has no authenticated /scale, so it must never render.
    render(<RecipeBody recipe={scalable} />)
    expect(screen.queryByLabelText(/more servings/i)).toBeNull()
  })

  it('does not show the stepper when the recipe has no servings', () => {
    render(<RecipeBody recipe={{ ...scalable, servings: null }} scalable />)
    expect(screen.queryByLabelText(/more servings/i)).toBeNull()
  })

  it('starts at the recipe’s own count and fetches nothing at rest', () => {
    render(<RecipeBody recipe={scalable} scalable />)
    expect(screen.getByLabelText(/more servings/i)).toBeInTheDocument()
    // The count reads 4 and no scale request has fired yet.
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(scaleRecipe).not.toHaveBeenCalled()
  })

  it('fetches the scaled amounts when the count changes, and shows them', async () => {
    scaleRecipe.mockResolvedValue({
      data: {
        ...scalable,
        servings: 8,
        ingredients: [
          { name: 'Chicken', quantity_text: '4.0 lbs', quantity_type: 'precise', position: 1 },
          // Non-linear: kept verbatim, with the multiplier as a scale_note.
          {
            name: 'Water',
            quantity_text: '3 fingers',
            quantity_type: 'imprecise',
            position: 2,
            scale_note: '×2',
          },
        ],
      },
    })
    render(<RecipeBody recipe={scalable} scalable />)
    await userEvent.click(screen.getByLabelText(/more servings/i)) // 4 → 5
    await waitFor(() => expect(scaleRecipe).toHaveBeenCalledWith(7, 5))
    // The scaled ingredient and the verbatim-with-×N note both render.
    expect(await screen.findByText('4.0 lbs')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
    // "3 fingers" stayed verbatim — fidelity held.
    expect(screen.getByText('3 fingers')).toBeInTheDocument()
  })

  it('offers a reset back to the original count', async () => {
    scaleRecipe.mockResolvedValue({
      data: { ...scalable, servings: 5, ingredients: scalable.ingredients },
    })
    render(<RecipeBody recipe={scalable} scalable />)
    await userEvent.click(screen.getByLabelText(/more servings/i))
    const reset = await screen.findByText(/scaled from 4 — reset/i)
    await userEvent.click(reset)
    // Back at 4, the reset link is gone.
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText(/scaled from/i)).toBeNull()
  })

  it('never goes below 1 serving', async () => {
    render(<RecipeBody recipe={{ ...scalable, servings: 1 }} scalable />)
    const minus = screen.getByLabelText(/fewer servings/i)
    expect(minus).toBeDisabled()
  })
})
