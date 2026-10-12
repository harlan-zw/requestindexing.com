import { afterEach, expect, it } from 'vitest'
import { createApp } from 'vue'
import UiSparkline from './UiSparkline.vue'

let app: ReturnType<typeof createApp> | undefined
afterEach(() => app?.unmount())

const rising = Array.from({ length: 180 }, (_, index) => index === 40 ? 100 : index >= 90 ? 2 : 0)

it.each([
  { data: rising, label: 'upward', early: '1.11', recent: '2' },
  { data: rising.toReversed(), label: 'downward', early: '2', recent: '1.11' },
  { data: rising, inverted: true, label: 'worsening', early: '1.11', recent: '2' },
  { data: rising.toReversed(), inverted: true, label: 'improving', early: '2', recent: '1.11' },
  { data: Array.from<number>({ length: 180 }).fill(0), label: 'flat', early: '0', recent: '0' },
  { data: Array.from<number>({ length: 180 }).fill(5), label: 'flat', early: '5', recent: '5' },
  { data: rising.map((value, index) => ({ date: String(index), metric: value })), yAxis: 'metric', label: 'upward', early: '1.11', recent: '2' },
])('announces the full history as $label', async ({ data, label, early, recent, ...props }) => {
  const host = document.createElement('div')
  app = createApp(UiSparkline, { data, ...props })
  app.mount(host)
  expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe(`Sparkline, ${label} trend, averaging ${early} early to ${recent} recently`)
})

it.each([20, 80, 180])('keeps the full-history direction with a %i-point drawing budget', (maxPoints) => {
  const host = document.createElement('div')
  app = createApp(UiSparkline, { data: rising, maxPoints })
  app.mount(host)
  expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe('Sparkline, upward trend, averaging 1.11 early to 2 recently')
})

it('preserves original peak days in both sampled histories', () => {
  const host = document.createElement('div')
  const data = Array.from({ length: 180 }, (_, day) => day === 117 ? 500 : 0)
  const previousData = Array.from({ length: 180 }, (_, day) => day === 40 ? 600 : 0)
  app = createApp(UiSparkline, { data, previousData, maxPoints: 20, variant: 'step' })
  app.mount(host)
  const paths = [...host.querySelectorAll('path[d][stroke]')]
  for (const [ghost, day] of [[false, 117], [true, 40]] as const) {
    const path = paths.find(path => ghost ? path.getAttribute('stroke') !== 'none' && !path.getAttribute('stroke')?.startsWith('url(') : path.getAttribute('stroke')?.startsWith('url('))
    const points = [...(path?.getAttribute('d') ?? '').matchAll(/(?:M|L) ([\d.e+-]+) ([\d.e+-]+)/gu)]
      .map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
    const peak = points.reduce((best, point) => point.y < best.y ? point : best)
    expect(peak.x).toBeCloseTo(1.5 + day / 179 * 117)
  }
})

it('splits missing days without losing observed zero values', () => {
  const host = document.createElement('div')
  app = createApp(UiSparkline, { data: [0, 0, null, 8, 6], variant: 'step' })
  app.mount(host)
  const path = host.querySelector('path[stroke^="url("]')?.getAttribute('d') ?? ''
  const starts = [...path.matchAll(/M ([\d.e+-]+)/gu)].map(match => Number(match[1]))
  expect(starts).toEqual([1.5, 1.5 + 3 / 4 * 117])
  expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe('Sparkline, upward trend, averaging 0 early to 7 recently')
})

it('retains a sparse peak when observed points fit the drawing budget', () => {
  const host = document.createElement('div')
  const data: Array<number | null> = Array.from<null>({ length: 180 }).fill(null)
  data.splice(50, 3, 10, 100, 10)
  app = createApp(UiSparkline, { data, maxPoints: 80, variant: 'step' })
  app.mount(host)
  const path = host.querySelector('path[stroke^="url("]')?.getAttribute('d') ?? ''
  const points = [...path.matchAll(/(?:M|L) ([\d.e+-]+) ([\d.e+-]+)/gu)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
  const peak = points.reduce((best, point) => point.y < best.y ? point : best)
  expect(peak.x).toBeCloseTo(1.5 + 51 / 179 * 117)
  expect(peak.y).toBeLessThan(points[0]!.y)
})

it('colors lower rank comparisons as improvements', () => {
  const host = document.createElement('div')
  app = createApp(UiSparkline, {
    data: [2, 2, 2],
    previousData: [3, 3, 3],
    inverted: true,
    comparisonStyle: 'diverging',
    comparisonColors: ['green', 'red', 'gray'],
  })
  app.mount(host)
  const stops = [...host.querySelectorAll('linearGradient[gradientUnits="userSpaceOnUse"] stop')]
  expect(stops.map(stop => stop.getAttribute('style'))).toEqual(['stop-color: green;', 'stop-color: green;', 'stop-color: green;'])
})

it('keeps curve controls within each retained time interval', () => {
  const host = document.createElement('div')
  app = createApp(UiSparkline, { data: Array.from({ length: 180 }, (_, day) => day === 117 ? 500 : 0), maxPoints: 20 })
  app.mount(host)
  const path = host.querySelector('path[stroke^="url("]')?.getAttribute('d') ?? ''
  let previous = Number(path.match(/^M ([\d.e+-]+)/u)?.[1])
  const curves = [...path.matchAll(/C ([\d.e+-]+) [\d.e+-]+, ([\d.e+-]+) [\d.e+-]+, ([\d.e+-]+) [\d.e+-]+/gu)]
  expect(curves.length).toBeGreaterThan(0)
  for (const curve of curves) {
    const end = Number(curve[3])
    for (const value of [Number(curve[1]), Number(curve[2])]) {
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeLessThanOrEqual(end)
    }
    previous = end
  }
})
