import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))
vi.mock('../api/sharing', () => ({ getSharedWithMe: vi.fn() }))
import client from '../api/client'
import { getSharedWithMe } from '../api/sharing'
import Home from './Home'

const OWNED = {
  id: 1,
  user_id: 7,
  name: 'Sinigang',
  cuisine: 'Filipino',
  origin_attribution: 'Lola Remedios · Cebu',
  cover_photo_url: null,
}
const HANDED = {
  id: 2,
  user_id: 42,
  name: 'Braised pork belly',
  author_full_name: 'Auntie Ling',
  cover_photo_url: null,
}
// A public recipe belonging to someone the user has no relationship with — the
// thing "Passed down lately" shows, and the thing that must not outrank the
// user's own food.
const PUBLIC_OTHER = {
  id: 3,
  user_id: 99,
  name: 'A stranger’s congee',
  author_full_name: 'Someone Else',
  cover_photo_url: null,
}

// Home reads three endpoints off one mocked client.get, so route by URL rather
// than by call order — the component fires them concurrently.
function mockApi({ mine = [], browse = [], shared = [] } = {}) {
  client.get.mockImplementation((url) => {
    if (url === '/recipes') return Promise.resolve({ data: mine })
    if (url === '/recipes/browse') return Promise.resolve({ data: browse })
    return Promise.resolve({ data: [] })
  })
  getSharedWithMe.mockResolvedValue({ data: shared })
}

function renderHome(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add" element={<div>add page</div>} />
        <Route path="/shared" element={<div>shared page</div>} />
        <Route path="/recipes/:id" element={<div>recipe page</div>} />
        <Route path="/recipes/:id/edit" element={<div>edit page</div>} />
        <Route path="/my-recipes" element={<div>kitchen page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('issei_user', JSON.stringify({ id: 7, first_name: 'Mia' }))
  client.get.mockReset()
  getSharedWithMe.mockReset()
})

describe('Home — first run, empty-handed', () => {
  it('orients in one line and points at the first action', async () => {
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/the one person who asked for it/i)).toBeInTheDocument()
  })

  it('does NOT re-teach what /welcome just taught', async () => {
    // /welcome runs immediately before this screen for a new signup and shows
    // the sample card. Repeating it here read as the app forgetting it had
    // already explained itself.
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
    expect(screen.queryByText('their way')).not.toBeInTheDocument()
    expect(screen.queryByText(/a good splash/i)).not.toBeInTheDocument()
  })

  it('makes NO claim about voice or audio anywhere', async () => {
    // Step.voice_note is a TEXT column typed by whoever recorded the recipe.
    // Implying a recording would be a lie about the product.
    mockApi()
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/really made/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/\bvoice\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/recording|audio|listen/i)).not.toBeInTheDocument()
  })

  it('keeps the first action one tap away', async () => {
    mockApi()
    renderHome()
    const cta = await screen.findByRole('button', {
      name: /keep your first recipe/i,
    })
    await userEvent.click(cta)
    expect(await screen.findByText('add page')).toBeInTheDocument()
  })
})

describe('Home — first run, holding a handed-down recipe', () => {
  it('leads with the recipe they were sent, not "add your first recipe"', async () => {
    // The headline case: they followed a texted link, signed up to keep the
    // recipe, and Home used to greet them as if they had nothing.
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/someone passed you a/i)).toBeInTheDocument(),
    )
    expect(screen.getByText('Braised pork belly')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /keep your first recipe/i }),
    ).not.toBeInTheDocument()
  })

  it('does not show the abstract sample when it has a real recipe to show', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText('Braised pork belly')).toBeInTheDocument(),
    )
    // Their own recipe teaches better than the illustration.
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
  })

  it('offers authoring second, as an invitation rather than a demand', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByText(/got one of your own/i)).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /keep a recipe/i }))
    expect(await screen.findByText('add page')).toBeInTheDocument()
  })

  it('opens the handed recipe when tapped', async () => {
    mockApi({ mine: [], shared: [HANDED] })
    renderHome()
    await userEvent.click(
      await screen.findByRole('button', { name: /braised pork belly/i }),
    )
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })

  it('still shows public recipes, even before the user authors their own', async () => {
    // The bug: this branch returned after "Passed to you" without ever rendering
    // the public feed, so a user handed a recipe (but with none of their own) saw
    // only their handoff while public recipes sat in Browse.
    mockApi({ mine: [], shared: [HANDED], browse: [PUBLIC_OTHER] })
    renderHome()
    expect(
      await screen.findByText('A stranger’s congee'),
    ).toBeInTheDocument()
    expect(screen.getByText(/passed down lately/i)).toBeInTheDocument()
  })
})

describe('Home — returning user', () => {
  it('drops the explanation entirely once a recipe is kept (no nagging)', async () => {
    mockApi({ mine: [OWNED] })
    renderHome()
    // The hero IS a recipe now, so its presence is what says "not first run".
    await waitFor(() =>
      expect(screen.getAllByText('Sinigang').length).toBeGreaterThan(0),
    )
    // Nothing to dismiss and nothing that reappears: the pitch is a property of
    // having nothing, so it cannot come back once they have something.
    expect(screen.queryByText('3 soup spoons')).not.toBeInTheDocument()
    expect(screen.queryByText(/really made/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/got one of your own/i)).not.toBeInTheDocument()
  })

  it('keeps recipes passed to them visible on Home, above the public feed', async () => {
    // Before: once a recipient added a recipe of their own, the recipe they
    // joined issei for disappeared from Home entirely.
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    // getAllByText: the handed recipe is named TWICE now — once in the hero
    // ("Waiting for you: …") and once on its card.
    await waitFor(() =>
      expect(screen.getAllByText('Braised pork belly').length).toBeGreaterThan(0),
    )
    const passed = screen.getByRole('button', { name: /passed to you/i })
    await userEvent.click(passed)
    expect(await screen.findByText('shared page')).toBeInTheDocument()
  })

  it('puts the user’s own kitchen ABOVE the public feed', async () => {
    // The section order was hero → public feed → your kitchen, so someone opening
    // the app scrolled past strangers' dishes to reach their own. POSITIONING.md
    // disclaims discovery-from-strangers as a selling point, so having it outrank
    // the user's own food contradicted the product.
    mockApi({ mine: [OWNED], shared: [], browse: [PUBLIC_OTHER] })
    renderHome()
    const kitchen = await screen.findByRole('button', { name: /^your kitchen/i })
    const feed = await screen.findByRole('button', { name: /passed down lately/i })
    // compareDocumentPosition: 4 === FOLLOWING, i.e. the feed comes after.
    expect(kitchen.compareDocumentPosition(feed) & 4).toBeTruthy()
  })

  it('names a real dish in the hero instead of only asking a question', async () => {
    // "What's cooking tonight?" asked something and answered it with a link to a
    // list. A recipe someone SENT you outranks one you wrote — that's the moment
    // this app exists for.
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    expect(await screen.findByText(/waiting for you/i)).toBeInTheDocument()
  })

  it('drops the brick Browse bar from the first viewport', async () => {
    // A full-width saturated bar directly under the hero, competing with it for
    // attention, pointing at the least important destination on the page — and
    // Browse already has a nav tab. Its count also summed the public feed with the
    // user's own recipes into one number that meant nothing.
    mockApi({ mine: [OWNED], shared: [] })
    renderHome()
    await screen.findByRole('button', { name: /^your kitchen/i })
    expect(screen.queryByRole('button', { name: /browse all/i })).toBeNull()
    expect(screen.queryByText(/recipes to cook/i)).toBeNull()
  })

  it('waits for the shared answer before deciding the kitchen is empty', async () => {
    // A race here would flash "add your first recipe" at someone who was just
    // handed one — the worst possible first frame.
    let release
    getSharedWithMe.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ data: [HANDED] })
      }),
    )
    client.get.mockResolvedValue({ data: [] })
    renderHome()
    await waitFor(() => expect(client.get).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: /keep your first recipe/i }),
    ).not.toBeInTheDocument()
    release()
    await waitFor(() =>
      expect(screen.getByText(/someone passed you a/i)).toBeInTheDocument(),
    )
  })

  it('still renders when the shared lookup fails', async () => {
    mockApi({ mine: [OWNED] })
    getSharedWithMe.mockRejectedValue(new Error('offline'))
    renderHome()
    // A failed shared lookup must not blank the page — the user's own kitchen is
    // still there, and the hero falls back to their own newest recipe.
    await waitFor(() =>
      expect(screen.getAllByText('Sinigang').length).toBeGreaterThan(0),
    )
    expect(
      screen.getByRole('button', { name: /^your kitchen/i }),
    ).toBeInTheDocument()
  })
})

// The hero is the biggest thing on the page. Without a stated reason it reads as an
// arbitrary pick — which is what these pin: the heading is TRUE, and it never
// claims an editorial judgement nobody made.
describe('Home — the hero says why this recipe', () => {
  it('leads with a handed recipe, named as waiting for you', async () => {
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    expect(await screen.findByText(/waiting for you/i)).toBeInTheDocument()
    // ...and it's the handed one in the hero, not the user's own.
    expect(screen.getAllByText('Braised pork belly').length).toBeGreaterThan(0)
  })

  it('never labels the hero as an editorial pick', async () => {
    // "Recipe of the week" would assert a judgement nobody exercised, and a global
    // pick would make issei a publication rather than a handoff.
    mockApi({ mine: [OWNED], shared: [] })
    renderHome()
    await screen.findByRole('button', { name: /^your kitchen/i })
    expect(
      screen.queryByText(/of the (day|week|month)|featured|trending/i),
    ).toBeNull()
  })

  it('shows a stranger-free hero — the public feed never gets top billing', async () => {
    // Home puts other people's public recipes below the user's own kitchen; the
    // hero must not undo that by promoting one into the largest component.
    mockApi({ mine: [OWNED], shared: [], browse: [PUBLIC_OTHER] })
    renderHome()
    await screen.findByRole('button', { name: /^your kitchen/i })
    const hero = screen.getByRole('button', { name: /open sinigang/i })
    expect(hero).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /open a stranger/i }),
    ).toBeNull()
  })
})

// The page was a hero over three identical grids — accurate, but one repeated shape
// with nothing to look at twice. These sections break that up using only what the
// app already knows, and every one of them must vanish rather than render empty:
// a stat strip of zeroes or a quote card with no quote is worse than the plain list.
describe('Home — things to explore', () => {
  const RICH = {
    id: 11,
    user_id: 7,
    name: 'Adobo',
    origin_attribution: 'Lola Remedios · Cebu',
    story: 'She made it every Sunday.',
    cover_photo_url: 'x.jpg',
    steps: [{ id: 1, content: 'Simmer', voice_note: 'Do not crowd the pan.' }],
    ingredients: [],
  }

  it('counts the kitchen up front — recipes and the people they came from', async () => {
    // Two dishes from two different people. (OWNED and RICH are both from Lola,
    // which is the point of the people grouping — it counts PEOPLE, not recipes.)
    mockApi({ mine: [RICH, { ...OWNED, origin_attribution: 'Tita Baby' }] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('2 recipes')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('2 people')).toBeInTheDocument()
  })

  it('counts a handed-down recipe as part of the kitchen', async () => {
    // Someone who was SENT a dish has it in their kitchen; a strip that ignored it
    // would undercount the one thing this app is for.
    mockApi({ mine: [RICH], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('2 recipes')).toBeInTheDocument(),
    )
  })

  it('never counts a stranger’s public recipe as part of the kitchen', async () => {
    // Browse is a feed, not a kitchen. Folding it in would inflate every number and
    // put a stranger in "whose recipes live here".
    mockApi({ mine: [RICH], browse: [PUBLIC_OTHER] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('1 recipe')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Someone')).toBeNull()
  })

  it('shows whose recipes live here, and filters the kitchen by them', async () => {
    mockApi({ mine: [RICH], shared: [HANDED] })
    renderHome()
    // Captioned "Remedios" — the honorific is stripped so three different aunties
    // in one kitchen don't all read as "Auntie". See kitchenFacts.shortName.
    const person = await screen.findByText('Remedios')
    await userEvent.click(person)
    expect(await screen.findByText('kitchen page')).toBeInTheDocument()
  })

  it('does NOT lift a quote out of a recipe onto the page', async () => {
    // A "Their words" card sat between the grids showing one folk amount or step
    // remark. It read as a fragment — the line was charming, but the dish it belonged
    // to wasn't on screen, so it had nowhere to land. The material moved to where it
    // appears WITH its dish: the frame of a recipe with no photo.
    mockApi({ mine: [RICH] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('1 recipe')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/^their words$/i)).toBeNull()
    expect(screen.queryByText('Do not crowd the pan.')).toBeNull()
  })

  it('nudges the user to fill a gap, straight into the editor', async () => {
    mockApi({ mine: [OWNED] }) // no steps, no story, no photo
    renderHome()
    await userEvent.click(await screen.findByText('how it’s made'))
    expect(await screen.findByText('edit page')).toBeInTheDocument()
  })

  it('never nudges about a recipe someone else owns', async () => {
    // patch_recipe filters on user_id, so "fill this in" on a handed-down recipe
    // would send the user to an editor that refuses to save.
    mockApi({ mine: [RICH], shared: [HANDED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('2 recipes')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/how it’s made/)).toBeNull()
  })

  it('states the recipe count ONCE, not twice in two type styles', async () => {
    // The hero's own caption said "4 in your kitchen" directly above a "4 RECIPES"
    // pill. Same fact, two treatments, three centimetres apart.
    mockApi({ mine: [RICH, OWNED] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('2 recipes')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/in your kitchen/)).toBeNull()
  })

  it('drops every section that has nothing real to show', async () => {
    // A complete, solo kitchen: no gaps to fill, one person so no row, and the
    // cooks pill omitted because nothing calls the cook endpoint yet.
    mockApi({ mine: [RICH] })
    renderHome()
    await waitFor(() =>
      expect(screen.getByLabelText('1 recipe')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/whose recipes live here/i)).toBeNull()
    expect(screen.queryByText(/fill these in/i)).toBeNull()
    expect(screen.queryByText(/cooks?$/)).toBeNull()
  })
})

// The hero is a SWIPEABLE deck now. The card design already promised more ("there
// are more of these", said with sheets under the bottom edge), so showing exactly one
// was a broken promise. These pin what must stay true as you swipe.
describe('Home — the hero deck', () => {
  it('leads with the recipe someone handed you', async () => {
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    expect(await screen.findByText(/waiting for you/i)).toBeInTheDocument()
    expect(screen.getAllByText('Braised pork belly').length).toBeGreaterThan(0)
  })

  it('puts every hero recipe in the deck, capped so it stays a hero', async () => {
    // A fifth card is a swipe nobody takes when "Your kitchen" is one scroll below.
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...OWNED,
      id: 100 + i,
      name: `Dish ${i}`,
    }))
    mockApi({ mine: many })
    renderHome()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show Dish 0' })).toBeInTheDocument(),
    )
    expect(screen.getAllByRole('button', { name: /^Show Dish/ })).toHaveLength(4)
  })

  it('shows a dot per card so the deck reads as swipeable at all', async () => {
    // Without an affordance a horizontal scroller is invisible — people don't try.
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    const dots = await screen.findAllByRole('button', { name: /^Show / })
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveAttribute('aria-current', 'true')
  })

  it('does not draw dots for a single recipe', async () => {
    mockApi({ mine: [OWNED] })
    renderHome()
    await screen.findByRole('button', { name: /^Your kitchen/i })
    expect(screen.queryByRole('button', { name: /^Show / })).toBeNull()
  })

  it('says which card of how many, and never "1 of 1"', async () => {
    mockApi({ mine: [OWNED], shared: [HANDED] })
    const { unmount } = renderHome()
    const of = await screen.findByText('of')
    expect(of.parentElement.textContent.replace(/\s+/g, ' ')).toBe('1 of 2')
    unmount()

    mockApi({ mine: [OWNED] })
    renderHome()
    await screen.findByRole('button', { name: /^Your kitchen/i })
    expect(screen.queryByText('of')).toBeNull()
  })

  it('never labels the hero as an editorial pick', async () => {
    // "Recipe of the week" would assert a judgement nobody exercised, and a global
    // pick would make issei a publication rather than a handoff.
    mockApi({ mine: [OWNED], shared: [] })
    renderHome()
    await screen.findByRole('button', { name: /^Your kitchen/i })
    expect(
      screen.queryByText(/of the (day|week|month)|featured|trending/i),
    ).toBeNull()
  })

  it('keeps strangers out of the deck entirely', async () => {
    // Home puts other people's public recipes below the user's own kitchen; the hero
    // must not undo that by promoting one into the largest component.
    mockApi({ mine: [OWNED], shared: [], browse: [PUBLIC_OTHER] })
    renderHome()
    await screen.findByRole('button', { name: /^Your kitchen/i })
    expect(screen.getByRole('button', { name: /open sinigang/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open a stranger/i })).toBeNull()
  })

  it('the heading gets no marker swipe — the section titles own that', async () => {
    // A swipe here made the biggest element on the page read as just another section.
    mockApi({ mine: [OWNED], shared: [HANDED] })
    renderHome()
    const heading = await screen.findByRole('heading', { name: /waiting for you/i })
    expect(heading.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
