import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The routing table itself has no test coverage, and #57 turned /shared into a redirect.
// PublicOnlyRoute sends a just-claimed invite to /shared, so if that redirect's target
// were renamed the highest-intent moment in the product would dead-end — with nothing to
// catch it. This pins the one route whose whole job is to forward.
//
// Rendering App directly would mean mocking every page's API module, so this mounts the
// same <Navigate> declaration and separately asserts App.jsx still declares it — the pair
// fails if either the behavior or the real route string drifts.

function Landed() {
  const loc = useLocation()
  return <div data-testid="landed">{loc.pathname + loc.search}</div>
}

describe('/shared is a redirect to the Kept tab (#57)', () => {
  it('lands on /my-recipes with the kept tab selected', () => {
    render(
      <MemoryRouter initialEntries={['/shared']}>
        <Routes>
          <Route path="/shared" element={<Navigate to="/my-recipes?tab=kept" replace />} />
          <Route path="/my-recipes" element={<Landed />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('landed')).toHaveTextContent('/my-recipes?tab=kept')
  })

  it('App.jsx still declares that exact redirect', () => {
    // vitest runs with cwd = frontend/, and import.meta.url isn't a file: URL under jsdom.
    const src = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
    expect(src).toContain('path="/shared"')
    expect(src).toContain('to="/my-recipes?tab=kept"')
    // And the page it replaced is really gone, not merely unrouted.
    expect(src).not.toContain('SharedWithMe')
  })
})
