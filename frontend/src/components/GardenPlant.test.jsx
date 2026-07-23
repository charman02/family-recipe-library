import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import GardenPlant from './GardenPlant'

function svgOf(stage, extra = {}) {
  const { container } = render(<GardenPlant stage={stage} {...extra} />)
  return container.querySelector('svg.garden-plant')
}

describe('GardenPlant', () => {
  it('renders the requested stage as a data attribute', () => {
    expect(svgOf('sapling').getAttribute('data-stage')).toBe('sapling')
  })
  it('renders a taller plant for a tree than for a seed (varied heights)', () => {
    const seedH = Number(svgOf('seed').getAttribute('height'))
    const treeH = Number(svgOf('tree').getAttribute('height'))
    expect(treeH).toBeGreaterThan(seedH)
  })
  it('renders a smaller sprout than sapling (clear stage step)', () => {
    const sproutH = Number(svgOf('sprout').getAttribute('height'))
    const saplingH = Number(svgOf('sapling').getAttribute('height'))
    expect(sproutH).toBeLessThan(saplingH)
  })
  it('sways by default but not when reduceMotion is set', () => {
    expect(svgOf('tree').classList.contains('garden-sway')).toBe(true)
    expect(svgOf('tree', { reduceMotion: true }).classList.contains('garden-sway')).toBe(false)
  })
  it('falls back to the seed form for an unknown stage', () => {
    expect(svgOf('bogus').getAttribute('data-stage')).toBe('seed')
  })
})
