import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PostCard from './PostCard'

const post = (over = {}) => ({
  id: 1,
  user_id: 42,
  author_first_name: 'Lola',
  author_last_name: 'Cook',
  photo_url: 'https://img.test/x.jpg',
  dish_name: 'Adobo',
  description: null,
  recipe_id: null,
  created_at: '2026-08-18T12:00:00', // naive UTC, as the API serializes it
  ...over,
})

function renderCard(p) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PostCard post={p} />} />
        <Route path="/u/:id" element={<div>profile page</div>} />
        <Route path="/recipes/:id" element={<div>recipe page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PostCard', () => {
  it('renders the dish, author, and photo — and no like button (never)', () => {
    renderCard(post({ dish_name: 'Sinigang' }))
    expect(screen.getByText('Sinigang')).toBeInTheDocument()
    expect(screen.getByText('Lola Cook')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Sinigang' })).toBeInTheDocument()
    // No like affordance anywhere — a deliberate product rule.
    expect(screen.queryByRole('button', { name: /like/i })).toBeNull()
  })

  it('shows an optional description when present, omits it otherwise', () => {
    const { rerender } = renderCard(post({ description: 'a weeknight batch' }))
    expect(screen.getByText('a weeknight batch')).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <PostCard post={post({ description: null })} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('a weeknight batch')).toBeNull()
  })

  it('links to the recipe only when the post has one attached', async () => {
    const { rerender } = renderCard(post({ recipe_id: null }))
    expect(screen.queryByText(/see the recipe/i)).toBeNull()
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<PostCard post={post({ recipe_id: 7 })} />} />
          <Route path="/recipes/:id" element={<div>recipe page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /see the recipe/i }))
    expect(await screen.findByText('recipe page')).toBeInTheDocument()
  })

  it('opens the author profile when the name is tapped', async () => {
    renderCard(post())
    await userEvent.click(screen.getByRole('button', { name: /Lola Cook/i }))
    expect(await screen.findByText('profile page')).toBeInTheDocument()
  })

  // The bug this test locks down: created_at arrives WITHOUT a timezone, and JS
  // parses a zone-less ISO string as LOCAL time. Untreated, a post minutes old reads
  // as hours old (or "just now" for hours) depending on the viewer's offset. ago()
  // must treat the naive string as UTC. Pinning both the clock and the machine's
  // timezone would be ideal, but vitest can't relocate TZ mid-run — so assert the
  // property that survives ANY offset: a post 90s in the (UTC) past reads in minutes,
  // never "just now", which is what the pre-fix local-parse produced west of UTC.
  describe('relative time (ago)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    // Freeze "now" to a fixed UTC instant so the deltas below are exact.
    const now = new Date('2026-08-18T12:00:00Z')

    it('reads "just now" under a minute', () => {
      vi.setSystemTime(now)
      renderCard(post({ created_at: '2026-08-18T11:59:30' })) // 30s ago, UTC
      expect(screen.getByText('just now')).toBeInTheDocument()
    })

    it('reads minutes for a few-minutes-old post (not "just now")', () => {
      vi.setSystemTime(now)
      renderCard(post({ created_at: '2026-08-18T11:45:00' })) // 15m ago, UTC
      expect(screen.getByText('15m')).toBeInTheDocument()
    })

    it('reads hours within a day', () => {
      vi.setSystemTime(now)
      renderCard(post({ created_at: '2026-08-18T09:00:00' })) // 3h ago, UTC
      expect(screen.getByText('3h')).toBeInTheDocument()
    })

    it('reads days within a week', () => {
      vi.setSystemTime(now)
      renderCard(post({ created_at: '2026-08-16T12:00:00' })) // 2d ago, UTC
      expect(screen.getByText('2d')).toBeInTheDocument()
    })

    it('already-zoned timestamps are respected, not double-shifted', () => {
      vi.setSystemTime(now)
      renderCard(post({ created_at: '2026-08-18T11:59:30Z' })) // explicit Z, 30s ago
      expect(screen.getByText('just now')).toBeInTheDocument()
    })
  })
})
