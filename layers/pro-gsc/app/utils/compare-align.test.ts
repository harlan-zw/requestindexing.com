import { describe, expect, it } from 'vitest'
import { alignPrev, resolveCompareAligner } from './compare-align'

describe('comparison date alignment', () => {
  it('pairs sparse rows using the selected preceding window', () => {
    const current = [{ date: '2026-09-01', clicks: 1 }, { date: '2026-09-03', clicks: 2 }]
    const previous = [{ date: '2026-08-30', clicks: 10 }, { date: '2026-08-31', clicks: 20 }]
    expect(alignPrev(current, previous, resolveCompareAligner('previous', 3)))
      .toEqual([current[0], { ...current[1], prev: previous[1] }])
  })

  it('leaves leap day unpaired when the previous calendar has no matching day', () => {
    const current = [{ date: '2024-02-29' }]
    const previous = [{ date: '2023-02-28' }]
    expect(alignPrev(current, previous, resolveCompareAligner('year', null)))
      .toEqual(current)
  })

  it('leaves the overlay absent without an explicit window offset', () => {
    const current = [{ date: '2026-09-03' }]
    expect(alignPrev(current, [{ date: '2025-09-03' }], resolveCompareAligner('previous', null))).toEqual(current)
  })
})
