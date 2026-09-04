import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/friends', () => ({
  getFriends: vi.fn(),
  getFriendRequests: vi.fn(),
  getFriendSuggestions: vi.fn(),
  acceptFriend: vi.fn(() => Promise.resolve({})),
  removeFriend: vi.fn(() => Promise.resolve({})),
  requestFriend: vi.fn(() => Promise.resolve({})),
  discoverPeople: vi.fn(),
}))
import {
  getFriends,
  getFriendRequests,
  getFriendSuggestions,
  acceptFriend,
  requestFriend,
  discoverPeople,
} from '../api/friends'
import Friends from './Friends'

const person = (id, first, extra = {}) => ({
  id,
  user_id: id,
  first_name: first,
  last_name: 'Cook',
  state: 'pending',
  outgoing: false,
  created_at: '2026-08-18T00:00:00Z',
  ...extra,
})

function mock({ friends = [], requests = [], suggestions = [], people = [] } = {}) {
  getFriends.mockResolvedValue({ data: friends })
  getFriendRequests.mockResolvedValue({ data: requests })
  getFriendSuggestions.mockResolvedValue({ data: suggestions })
  discoverPeople.mockResolvedValue({ data: people })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Friends />
    </MemoryRouter>,
  )

beforeEach(() => vi.clearAllMocks())

describe('Friends page', () => {
  it('shows the empty state when there is nobody anywhere', async () => {
    mock({})
    renderPage()
    expect(await screen.findByText(/no one here yet/i)).toBeInTheDocument()
  })

  it('lists incoming requests and accepts one', async () => {
    mock({ requests: [person(2, 'Lola', { outgoing: false })] })
    renderPage()
    expect(await screen.findByText('Lola Cook')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    expect(acceptFriend).toHaveBeenCalledWith(2)
  })

  it('shows handoff-seeded suggestions with a reason, and adds one', async () => {
    mock({
      suggestions: [
        { user_id: 3, first_name: 'Tita', last_name: 'B', reason: 'sent' },
      ],
    })
    renderPage()
    expect(await screen.findByText('Tita B')).toBeInTheDocument()
    expect(screen.getByText(/you sent them a recipe/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(requestFriend).toHaveBeenCalledWith(3)
  })

  it('lists current friends', async () => {
    mock({ friends: [person(4, 'Sam', { state: 'accepted' })] })
    renderPage()
    expect(await screen.findByText('Sam Cook')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })
})

// The app-wide directory (#80). A real user couldn't work out how to add anyone: the
// only find-friends surface was the handoff-seeded suggestions list, which is EMPTY for
// anyone who's never been handed a recipe — so it rendered nothing at all.
describe('Friends page — everyone on issei', () => {
  const stranger = (id, first, last = 'Cook') => ({
    user_id: id,
    first_name: first,
    last_name: last,
  })

  it('lists other people even when you have no friends, requests or handoffs', async () => {
    mock({ people: [stranger(9, 'Ana')] })
    renderPage()
    // Await the ROW, not the heading: the heading is static markup and resolves before
    // the debounced directory load has landed.
    expect(await screen.findByText('Ana Cook')).toBeInTheDocument()
    expect(screen.getByText(/everyone on issei/i)).toBeInTheDocument()
    // ...and the "nobody anywhere" empty state must NOT also be on screen — it would
    // contradict the list right above it.
    expect(screen.queryByText(/no one here yet/i)).not.toBeInTheDocument()
  })

  it('adds someone from the directory', async () => {
    mock({ people: [stranger(9, 'Ana')] })
    renderPage()
    await screen.findByText('Ana Cook')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(requestFriend).toHaveBeenCalledWith(9)
  })

  it('KEEPS the person listed after adding, showing "Requested" instead', async () => {
    // A real user reported the old behaviour: tapping Add made the person vanish, which
    // reads as "did that work, or did I just remove them?" The row stays and changes label.
    mock({ people: [stranger(9, 'Ana')] })
    renderPage()
    await screen.findByText('Ana Cook')
    // What the server now returns for that person on the refetch.
    discoverPeople.mockResolvedValue({
      data: [{ ...stranger(9, 'Ana'), friend_state: 'requested', friendship_id: null }],
    })
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(discoverPeople).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Requested')).toBeInTheDocument()
    expect(screen.getByText('Ana Cook')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^add$/i })).toBeNull()
  })

  it('shows "Requested" from the server state alone, with no tap in this session', async () => {
    // The optimistic Set only covers the current session; a reload has to read as requested
    // too, or the bug comes back the moment the page is refreshed.
    mock({
      people: [{ ...stranger(9, 'Ana'), friend_state: 'requested', friendship_id: null }],
    })
    renderPage()
    expect(await screen.findByText('Requested')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^add$/i })).toBeNull()
  })

  it('offers Accept, not Add, to someone who asked YOU', async () => {
    mock({
      people: [{ ...stranger(9, 'Ana'), friend_state: 'incoming', friendship_id: 77 }],
    })
    renderPage()
    await screen.findByText('Ana Cook')
    expect(screen.queryByRole('button', { name: /^add$/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    // Accepts by friendship id — the row carries it precisely so this works from here.
    await waitFor(() => expect(acceptFriend).toHaveBeenCalledWith(77))
  })

  it('searches SERVER-side, so it reaches past the capped page on screen', async () => {
    mock({ people: [stranger(9, 'Ana'), stranger(10, 'Ben')] })
    renderPage()
    await screen.findByText('Ana Cook')
    discoverPeople.mockResolvedValue({ data: [stranger(10, 'Ben')] })
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'ben')
    await waitFor(() => expect(discoverPeople).toHaveBeenLastCalledWith('ben'))
    expect(await screen.findByText('Ben Cook')).toBeInTheDocument()
  })

  it('debounces typing into one request, not one per keystroke', async () => {
    mock({ people: [] })
    renderPage()
    await waitFor(() => expect(discoverPeople).toHaveBeenCalledTimes(1))
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'anna')
    await waitFor(() => expect(discoverPeople).toHaveBeenLastCalledWith('anna'))
    // Exactly two: the immediate first load, then one settled search for 4 keystrokes.
    expect(discoverPeople).toHaveBeenCalledTimes(2)
  })

  it('says nobody matched instead of looking broken, and keeps the search box', async () => {
    mock({ people: [stranger(9, 'Ana')] })
    renderPage()
    await screen.findByText('Ana Cook')
    discoverPeople.mockResolvedValue({ data: [] })
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'zzz')
    expect(await screen.findByText(/nobody here called/i)).toBeInTheDocument()
    // A search with no hits is NOT "the app is empty" — that empty state would strand
    // the user with no way to clear the term.
    expect(screen.queryByText(/no one here yet/i)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument()
  })

  it('keeps handoff suggestions ABOVE the directory — a stronger signal outranks a stranger', async () => {
    mock({
      suggestions: [
        { user_id: 3, first_name: 'Tita', last_name: 'B', reason: 'sent' },
      ],
      people: [stranger(9, 'Ana')],
    })
    renderPage()
    await screen.findByText('Ana Cook')
    const html = document.body.innerHTML
    expect(html.indexOf('Tita B')).toBeLessThan(html.indexOf('Ana Cook'))
  })

  it('a failed load says so instead of claiming the app is empty', async () => {
    mock({})
    discoverPeople.mockRejectedValue(new Error('offline'))
    renderPage()
    expect(await screen.findByText(/couldn.t load people just now/i)).toBeInTheDocument()
    // "Nobody else yet" and "no one here yet" would both be flat lies about the app
    // when the truth is that the request failed.
    expect(screen.queryByText(/nobody else yet/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no one here yet/i)).not.toBeInTheDocument()
  })

  it('ignores a slow earlier response that lands after a newer one', async () => {
    // The search-box race: clearTimeout only cancels a request that hasn't FIRED yet.
    // Once "an" is in flight, typing on to "ana" and getting THAT result back first
    // must not be overwritten when the older, slower "an" response finally lands.
    let releaseFirst
    const slowFirst = new Promise((resolve) => {
      releaseFirst = () =>
        resolve({ data: [stranger(1, 'STALE'), stranger(2, 'Ben')] })
    })
    mock({})
    discoverPeople.mockReturnValueOnce(slowFirst)
    renderPage()
    await waitFor(() => expect(discoverPeople).toHaveBeenCalledTimes(1))

    discoverPeople.mockResolvedValue({ data: [stranger(9, 'Ana')] })
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), 'ana')
    expect(await screen.findByText('Ana Cook')).toBeInTheDocument()

    releaseFirst()
    await waitFor(() =>
      expect(screen.queryByText('STALE Cook')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Ana Cook')).toBeInTheDocument()
  })

  it('never claims "no one here yet" while the directory is still loading', async () => {
    // The bug the branch reviewer caught. `friends === null` gates a Loader that clears
    // as soon as getFriends resolves, but the directory load lands later — so treating
    // "not loaded yet" as "empty" painted the exact false message #80 exists to remove,
    // on the exact page built to remove it, for the exact user it targets.
    mock({})
    discoverPeople.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    // Wait until the page is past its Loader (friends resolved), then assert.
    expect(await screen.findByText(/everyone on issei/i)).toBeInTheDocument()
    expect(screen.queryByText(/no one here yet/i)).not.toBeInTheDocument()
  })

  it('acknowledges the tap so a row never keeps a live Add button', async () => {
    mock({ people: [stranger(9, 'Ana')] })
    renderPage()
    await screen.findByText('Ana Cook')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByText(/^requested$/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^add$/i })).not.toBeInTheDocument()
  })
})
