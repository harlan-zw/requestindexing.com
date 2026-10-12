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
