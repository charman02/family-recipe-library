import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeopleRow, TheirWordsCard, FinishThese, KitchenGlance } from './KitchenSections'

const r = (over = {}) => ({ id: 1, name: 'Dish', steps: [], ingredients: [], ...over })

describe('PeopleRow', () => {
  it('shows each person once with how many they left here', () => {
    render(
      <PeopleRow
        recipes={[
          r({ id: 1, origin_attribution: 'Lola Remedios · Cebu' }),
          r({ id: 2, origin_attribution: 'Lola Remedios · Cebu' }),
          r({ id: 3, author_full_name: 'Mia Chen' }),
        ]}
      />,
    )
    expect(screen.getByText('Remedios')).toBeInTheDocument()
    expect(screen.getByText('Mia')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('hides itself when there is only one person — one name is not a collection', () => {
    // A row of exactly one avatar reads as a bug, and it says nothing the byline
    // on the hero doesn't already say.
    const { container } = render(
      <PeopleRow recipes={[r({ origin_attribution: 'Lola Remedios · Cebu' })]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('hands the whole person back so the caller can filter by them', async () => {
    const onPerson = vi.fn()
    render(
      <PeopleRow
        onPerson={onPerson}
        recipes={[
          r({ id: 1, origin_attribution: 'Auntie Ling · Fuzhou' }),
          r({ id: 2, author_full_name: 'Mia' }),
        ]}
      />,
    )
    // Shown as "Ling", but the FULL name goes back — that's what the filter
    // matches on, and truncating it there would silently match nothing.
    await userEvent.click(screen.getByText('Ling'))
    expect(onPerson).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Auntie Ling', count: 1 }),
    )
  })

  it('reads the full name to a screen reader, not the truncated caption', async () => {
    render(
      <PeopleRow
        recipes={[
          r({ id: 1, origin_attribution: 'Auntie Ling' }),
          r({ id: 2, author_full_name: 'Mia' }),
        ]}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Auntie Ling — 1 recipe' }),
    ).toBeInTheDocument()
  })
})

// TheirWordsCard is GONE from Home — a folk amount or step remark read as a fragment
// with the dish it belongs to nowhere in sight. The component still exists and is
// tested because the same material now fills a photo-less recipe's frame, WITH its
// dish (see lib/coverText.js + CoverImage).
describe.skip('TheirWordsCard (removed from Home)', () => {
  const withNote = r({
    id: 5,
    name: 'Adobo',
    origin_attribution: 'Lola · Cebu',
    steps: [{ id: 1, content: 'Simmer', voice_note: 'Do not crowd the pan.' }],
  })

  it('quotes a real line and says whose recipe it came from', () => {
    render(<TheirWordsCard recipes={[withNote]} />)
    expect(screen.getByText('Do not crowd the pan.')).toBeInTheDocument()
    expect(screen.getByText(/Lola · Adobo/)).toBeInTheDocument()
  })

  it('renders nothing when there is nothing quotable', () => {
    // A kitchen of terse recipes must not get an empty quote card.
    const { container } = render(<TheirWordsCard recipes={[r()]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('makes NO claim that the line was spoken', () => {
    // Step.voice_note is a Text column someone typed. POSITIONING.md: never
    // "voice", "recording", "audio", "listen", or "in their words".
    render(<TheirWordsCard recipes={[withNote]} />)
    expect(screen.queryByText(/voice|recording|audio|listen|own words/i)).toBeNull()
  })

  it('opens the recipe the line came from', async () => {
    const onOpen = vi.fn()
    render(<TheirWordsCard recipes={[withNote]} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }))
  })
})

describe('FinishThese', () => {
  it('names the gap rather than scoring the recipe', () => {
    // A completeness percentage would turn someone's grandmother's dish into a
    // graded document. Naming the missing thing is actionable and not a judgement.
    render(<FinishThese recipes={[r({ name: 'Adobo' })]} />)
    expect(screen.getByText('how it’s made')).toBeInTheDocument()
    expect(screen.queryByText(/%|complete|score/i)).toBeNull()
  })

  it('says who each recipe is from', () => {
    // Without it the list was three bare dish titles. The person is the thing that
    // makes filling one in feel worth doing, and plum is the person colour.
    render(
      <FinishThese
        recipes={[r({ name: 'Adobo', origin_attribution: 'Lola Remedios · Cebu' })]}
      />,
    )
    expect(screen.getByText('Lola Remedios')).toBeInTheDocument()
  })

  it('gives each KIND of gap its own glyph, not just different words', () => {
    // Three rows differing only in a few words of small type read as one repeated
    // row — you had to read every chip to find the one you cared about.
    const { container } = render(
      <FinishThese
        recipes={[
          r({ id: 1, name: 'NoSteps', story: 's', cover_photo_url: 'x' }),
          r({
            id: 2,
            name: 'NoStory',
            cover_photo_url: 'x',
            steps: [{ content: 'go', voice_note: 'n' }],
          }),
        ]}
      />,
    )
    // The labels must not share a leading phrase: "ADD THE STEPS" and "ADD THE
    // STORY" were the same shape in small tracked caps, so two different asks read as
    // the same row twice. The distinguishing word now comes first.
    expect(screen.getByText('how it’s made')).toBeInTheDocument()
    expect(screen.getByText('the story behind it')).toBeInTheDocument()
    const labels = ['how it’s made', 'the story behind it']
    expect(labels[0].slice(0, 4)).not.toBe(labels[1].slice(0, 4))
    // Two rows, two different glyphs.
    const svgs = [...container.querySelectorAll('svg')]
    expect(svgs.length).toBeGreaterThanOrEqual(2)
    expect(svgs[0].innerHTML).not.toBe(svgs[1].innerHTML)
  })

  it('disappears entirely when nothing is missing', () => {
    const done = r({
      story: 'A story.',
      cover_photo_url: 'x.jpg',
      steps: [{ content: 'Do it', voice_note: 'gently' }],
    })
    const { container } = render(<FinishThese recipes={[done]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('KitchenGlance', () => {
  it('counts what is there, singular when it should be', () => {
    render(<KitchenGlance recipes={[r({ author_full_name: 'Mia' })]} />)
    expect(screen.getByText('recipe')).toBeInTheDocument()
    expect(screen.getByText('person')).toBeInTheDocument()
  })

  it('never shows a cooks pill — the number is always zero today', () => {
    // Nothing in the UI calls POST /{id}/cook (task #32), so a cooks stat would be
    // a proud nought pretending to be a stat. "Their words" took its slot because
    // that number is real AND is the one no competitor could print.
    render(
      <KitchenGlance recipes={[r({ author_full_name: 'Mia', cook_count: 3 })]} />,
    )
    expect(screen.queryByText(/cooks?/)).toBeNull()
  })

  it('counts their words when there are any', () => {
    render(
      <KitchenGlance
        recipes={[
          r({ author_full_name: 'Mia', steps: [{ voice_note: 'Go gently.' }] }),
        ]}
      />,
    )
    expect(screen.getByLabelText('1 in their words')).toBeInTheDocument()
  })

  it('drops the their-words pill rather than showing a zero', () => {
    render(<KitchenGlance recipes={[r({ author_full_name: 'Mia' })]} />)
    expect(screen.queryByText(/their words/i)).toBeNull()
  })

  it('does not reuse the quote section title as a stat label', () => {
    // A pill labelled "their words" sat above a card titled "Their words" — two
    // different things with one name, which reads as the same feature twice.
    render(
      <KitchenGlance
        recipes={[r({ author_full_name: 'Mia', steps: [{ voice_note: 'Gently.' }] })]}
      />,
    )
    expect(screen.getByText('in their words')).toBeInTheDocument()
    expect(screen.queryByText(/^their words$/i)).toBeNull()
  })
})
