import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useChartTickPlan } from './useChartTickPlan'

// 90 reporting days: the fortnightly branch, seven "Aug 15" style labels.
const dates = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10))

function planned(width?: number): number[] {
  return useChartTickPlan({ dates, width }).tickPlan.value.indices
}

describe('useChartTickPlan width', () => {
  it('keeps the span plan when the plot is desktop wide or not measured yet', () => {
    const span = planned()
    expect(span).toEqual([0, 14, 28, 42, 56, 70, 84])
    expect(planned(0)).toEqual(span)
    expect(planned(1280)).toEqual(span)
  })

  it('drops colliding labels on a phone-width plot and keeps both ends', () => {
    const span = planned()
    const phone = planned(320)
    expect(phone.length).toBeLessThan(span.length)
    expect(phone[0]).toBe(span[0])
    expect(phone.at(-1)).toBe(span.at(-1))
    expect(phone.every(i => span.includes(i))).toBe(true)
  })

  it('thins again when the measured width arrives after the first render', () => {
    const width = ref<number | undefined>(undefined)
    const { tickPlan } = useChartTickPlan({ dates, width })
    const unmeasured = tickPlan.value.indices
    expect(unmeasured).toEqual(planned())
    width.value = 320
    expect(tickPlan.value.indices.length).toBeLessThan(unmeasured.length)
  })
})
