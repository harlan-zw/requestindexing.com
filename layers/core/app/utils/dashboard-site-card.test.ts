import { describe, expect, it } from 'vitest'
import { resolveMetricDomain, resolvePlotRange } from './dashboard-site-card'

describe('dashboard site card', () => {
  it('keeps a non-zero trend away from the chart edges', () => {
    const [min, max] = resolveMetricDomain([950, 1000, 975])

    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThan(950)
    expect(max).toBeGreaterThan(1000)
  })

  it('keeps zero as the baseline when the series contains zero', () => {
    expect(resolveMetricDomain([0, 5, 10])[0]).toBe(0)
  })

  it('gives a constant series a visible domain', () => {
    const [min, max] = resolveMetricDomain([4, 4, 4])

    expect(min).toBeLessThan(4)
    expect(max).toBeGreaterThan(4)
  })

  it('uses the requested chart height and keeps better positions higher', () => {
    expect(resolvePlotRange(140, false)).toEqual([116, 8])
    expect(resolvePlotRange(140, true)).toEqual([8, 116])
  })
})
