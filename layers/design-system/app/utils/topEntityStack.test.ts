import { describe, expect, it } from 'vitest'
import { useChartTickPlan } from '../composables/useChartTickPlan'
import { bucketTopEntities, topEntityStackRows, topEntityStackTimeline } from './topEntityStack'

describe('topEntityStackRows', () => {
  it('shows changing shares across unequal totals while preserving raw counts', () => {
    const result = bucketTopEntities({
      dates: ['2026-09-01', '2026-09-02', '2026-09-03'],
      rows: [
        { date: '2026-09-01', key: 'a', label: 'A', value: 25 },
        { date: '2026-09-02', key: 'a', label: 'A', value: 100 },
      ],
      totals: [100, 200, 0],
      topN: 1,
    })
    expect(result.series.map(s => s.label)).toEqual(['A', 'All Others'])
    expect(topEntityStackRows(result)).toEqual([
      { i: 0, values: [25, 75], shares: [25, 75], total: 100 },
      { i: 1, values: [100, 100], shares: [50, 50], total: 200 },
      { i: 2, values: [0, 0], shares: [0, 0], total: 0 },
    ])
  })
})

describe('topEntityStackTimeline', () => {
  it('labels coarsened buckets with the same calendar ticks as a daily chart', () => {
    const dates = Array.from({ length: 28 }, (_, i) => new Date(Date.UTC(2026, 7, 15 + i)).toISOString().slice(0, 10))
    const result = bucketTopEntities({ dates, rows: [], maxBuckets: 10 })
    const timeline = topEntityStackTimeline(result.buckets)
    const daily = useChartTickPlan({ dates })
    const stack = useChartTickPlan({ dates: timeline.dates })
    expect(stack.tickPlan.value.indices.map(i => stack.tickFormat(i))).toEqual(
      daily.tickPlan.value.indices.map(i => daily.tickFormat(i)),
    )
    expect(timeline.positions[0]).toBe(-0.5)
    expect(timeline.positions.at(-1)).toBe(result.buckets.length - 0.5)
    expect(timeline.positions[24]).toBeCloseTo(24 / 27 * result.buckets.length - 0.5)
  })
})
