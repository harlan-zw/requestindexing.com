import { gscMetricColors } from '@nuxtseo/design-system/app/composables/dataVizColors'
import { describe, expect, it } from 'vitest'
import { translucentColor } from './chart-paint'

describe('translucentColor', () => {
  it('keeps the themed metric colour of a design-system series', () => {
    const paint = translucentColor(gscMetricColors.clicks.color, 0.3)
    expect(paint).toContain(gscMetricColors.clicks.color)
    expect(paint).toContain('30%')
  })
})
