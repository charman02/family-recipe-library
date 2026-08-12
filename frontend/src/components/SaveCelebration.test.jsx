import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveCelebration from './SaveCelebration'
import * as prefs from '../lib/prefs'

const recipe = { id: 1, name: 'Adobo', cuisine: 'Filipino' }

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('SaveCelebration — reduced motion', () => {
  it('shows the reveal immediately, with no animation phases', () => {
    // The recipe is already saved before this renders, so with motion reduced the
    // terminal reveal (checkmark + card + share) is up on the first frame.
    vi.spyOn(prefs, 'prefersReducedMotion').mockReturnValue(true)
    render(
      <SaveCelebration recipe={recipe} onView={() => {}} onShare={() => {}} />,
    )
    expect(screen.getByText(/saved to your kitchen/i)).toBeInTheDocument()
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /send it to someone/i }),
    ).toBeInTheDocument()
    // No timer dial rendered on the reduced-motion path.
    expect(document.querySelector('.animate-timer-sweep')).toBeNull()
  })

  it('wires the card to onView and the button to onShare', async () => {
    vi.spyOn(prefs, 'prefersReducedMotion').mockReturnValue(true)
    const onView = vi.fn()
    const onShare = vi.fn()
    render(
      <SaveCelebration recipe={recipe} onView={onView} onShare={onShare} />,
    )
    await userEvent.click(screen.getByText('Adobo'))
    expect(onView).toHaveBeenCalledTimes(1)
    await userEvent.click(
      screen.getByRole('button', { name: /send it to someone/i }),
    )
    expect(onShare).toHaveBeenCalledTimes(1)
  })
})

describe('SaveCelebration — full sequence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs timer → poof → reveal, and the card only appears AFTER the poof', () => {
    vi.spyOn(prefs, 'prefersReducedMotion').mockReturnValue(false)
    const onView = vi.fn()
    const onShare = vi.fn()
    render(
      <SaveCelebration recipe={recipe} onView={onView} onShare={onShare} />,
    )

    // Starts on the timer (the sweeping hand is present), no reveal yet.
    expect(document.querySelector('.animate-timer-sweep')).toBeInTheDocument()
    expect(screen.queryByText(/saved to your kitchen/i)).toBeNull()

    // → the steam cloud plays, ALONE. The card must NOT be mounted yet — that is
    // the whole point of the sequential change (no peek-through the cloud).
    act(() => vi.advanceTimersByTime(950))
    expect(document.querySelector('.animate-puff-poof')).toBeInTheDocument()
    expect(document.querySelector('.animate-timer-sweep')).toBeNull()
    expect(screen.queryByText('Adobo')).toBeNull()
    expect(screen.queryByText(/saved to your kitchen/i)).toBeNull()

    // → reveal (checkmark + card + share) only after the poof clears, and the
    // cloud is gone by then.
    act(() => vi.advanceTimersByTime(1550))
    expect(screen.getByText(/saved to your kitchen/i)).toBeInTheDocument()
    expect(screen.getByText('Adobo')).toBeInTheDocument()
    expect(document.querySelector('.animate-puff-poof')).toBeNull()

    // Nothing was called on the user's behalf — the actions wait for a tap.
    act(() => vi.advanceTimersByTime(5000))
    expect(onView).not.toHaveBeenCalled()
    expect(onShare).not.toHaveBeenCalled()
  })

  it('clears its timers on unmount', () => {
    vi.spyOn(prefs, 'prefersReducedMotion').mockReturnValue(false)
    const { unmount } = render(
      <SaveCelebration recipe={recipe} onView={() => {}} onShare={() => {}} />,
    )
    unmount()
    // Advancing past all phases must not throw (no setState on an unmounted tree).
    expect(() => act(() => vi.advanceTimersByTime(5000))).not.toThrow()
  })
})
