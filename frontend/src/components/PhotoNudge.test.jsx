import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The upload hook is stubbed: this component's job is WHO SEES IT and what dismissing
// persists. The upload pipeline itself (Cloudinary → PATCH /auth/me → refresh the cached
// user) is covered where it lives, in lib/useAvatarUpload.
const hook = vi.hoisted(() => ({ uploading: false, error: '', photoUrl: null, onPick: vi.fn() }))
vi.mock('../lib/useAvatarUpload', () => ({
  useAvatarUpload: ({ onDone } = {}) => {
    hook.lastOnDone = onDone
    return hook
  },
}))
vi.mock('../lib/photoUpload', () => ({ PHOTO_ACCEPT: 'image/*' }))
import PhotoNudge from './PhotoNudge'
import { loadPrefs } from '../lib/prefs'

const signIn = (over = {}) =>
  localStorage.setItem('issei_user', JSON.stringify({ id: 1, first_name: 'Ana', ...over }))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  hook.uploading = false
  hook.error = ''
  hook.photoUrl = null
})

describe('PhotoNudge (#84) — the retro ask for accounts that predate #77', () => {
  it('asks someone signed in with no photo', () => {
    signIn()
    render(<PhotoNudge />)
    expect(screen.getByText(/add a photo so friends know it/i)).toBeInTheDocument()
    // And it can be answered right here — not "go to Settings", which is how the problem
    // was reported in the first place.
    expect(screen.getByLabelText(/add a profile photo/i)).toBeInTheDocument()
  })

  it('says nothing to someone who already has a photo', () => {
    signIn({ photo_url: 'https://cdn.test/a.jpg' })
    render(<PhotoNudge />)
    expect(screen.queryByText(/add a photo/i)).not.toBeInTheDocument()
  })

  it('says nothing when nobody is signed in', () => {
    render(<PhotoNudge />)
    expect(screen.queryByText(/add a photo/i)).not.toBeInTheDocument()
  })

  it('disappears the moment an upload lands, without a refetch', () => {
    signIn()
    hook.photoUrl = 'https://cdn.test/new.jpg'
    render(<PhotoNudge />)
    expect(screen.queryByText(/add a photo/i)).not.toBeInTheDocument()
  })

  it('dismissing writes the SAME pref Profile’s reminder reads', async () => {
    // Deliberate: two nudges for one thing, each needing its own dismissal, is nagging.
    // One dismissal means "stop asking me", wherever it was tapped.
    signIn()
    const onDone = vi.fn()
    render(<PhotoNudge onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(loadPrefs().photoNudgeDismissed).toBe(true)
    expect(onDone).toHaveBeenCalled()
  })

  it('stays dismissed on the next render', () => {
    signIn()
    localStorage.setItem('issei_prefs', JSON.stringify({ photoNudgeDismissed: true }))
    render(<PhotoNudge />)
    // A reminder that returns every session is worse than none.
    expect(screen.queryByText(/add a photo/i)).not.toBeInTheDocument()
  })

  it('shows the upload error instead of the control, not on top of it', () => {
    signIn()
    hook.error = 'That file is too big.'
    render(<PhotoNudge />)
    expect(screen.getByText('That file is too big.')).toBeInTheDocument()
    expect(screen.queryByText(/choose a photo/i)).not.toBeInTheDocument()
  })

  it('says Uploading… while it works', () => {
    signIn()
    hook.uploading = true
    render(<PhotoNudge />)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()
  })

  it('never gates anything — there is no skip-required button', () => {
    signIn()
    render(<PhotoNudge />)
    // Only two controls: choose a photo, or not now. Nothing that blocks the app.
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName(/not now/i)
  })

  it('survives a corrupt issei_user blob instead of crashing Home', () => {
    localStorage.setItem('issei_user', 'not json')
    render(<PhotoNudge />)
    expect(screen.queryByText(/add a photo/i)).not.toBeInTheDocument()
  })
})
