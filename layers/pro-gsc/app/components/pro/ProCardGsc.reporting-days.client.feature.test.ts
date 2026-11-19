import type { App } from 'vue'
import { gscMetricColors } from '@nuxtseo/design-system/app/composables/dataVizColors'
import { calcTrendPercent } from '@nuxtseo/design-system/app/composables/formatting'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref, useId } from 'vue'
import ProCardGsc from './ProCardGsc.vue'

vi.mock('../../composables/useProGscFilters', () => ({ useProGscFilters: () => ({ period: ref('7d'), compareMode: ref('previous'), stableData: ref(false) }) }))
vi.mock('motion-v', async (importOriginal) => {
  const original = await importOriginal<typeof import('motion-v')>()
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return { ...original, AnimatePresence: pass, motion: { div: pass } }
})
vi.mock('#components', () => {
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return { ClientOnly: pass, UiButton: pass, UiIcon: pass, UiSkeleton: pass }
})
// Replace SVG layout only. The real shared chart supplies the tick values and formatter.
vi.mock('@unovis/vue', () => {
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  const axis = defineComponent({
    props: ['tickValues', 'tickFormat'],
    setup: props => () => h('div', { 'data-axis': '' }, props.tickValues?.map((i: number) => h('span', props.tickFormat(i)))),
  })
  return { VisXYContainer: pass, VisAxis: axis, VisArea: pass, VisCrosshair: pass, VisLine: pass, VisScatter: pass }
})
let app: App<Element> | undefined
afterEach(() => {
  app?.unmount()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

it('keeps seven reporting days aligned across axis, hover, comparison, drag and submitted range west of UTC', async () => {
  vi.stubEnv('TZ', 'America/Los_Angeles')
  expect(new Date('2026-11-19').getDate()).toBe(18)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
  vi.stubGlobal('calcTrendPercent', calcTrendPercent)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('useId', useId)
  vi.stubGlobal('useProDevSkeleton', () => ref(false))
  vi.stubGlobal('useProHumanFriendlyNumber', (n: number) => String(n))
  const dates = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${13 + i}`, clicks: i + 1, impressions: 100, position: 2, ctr: 0.1 }))
  const prevDates = dates.map((row, i) => ({ ...row, date: `2026-11-${String(6 + i).padStart(2, '0')}` }))
  const zoom = vi.fn()
  const props = ref({ dates, prevDates, period: null, prevPeriod: null, dateRange: 'custom:2026-11-13:2026-11-19' as const, columns: ['clicks'], showButtons: false, onZoom: zoom })
  app = createApp({ setup: () => () => h(ProCardGsc, props.value) })
  Object.assign(app.config.globalProperties, { gscMetricColors, useProHumanFriendlyNumber: (n: number) => String(n) })
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['ClientOnly', 'UiTrend', 'UIcon', 'UiSkeleton', 'UiPopover', 'UiSparkline', 'UiIcon', 'ProFavicon'])
    app.component(name, pass)
  const host = document.createElement('div')
  document.body.appendChild(host)
  app.mount(host)
  await nextTick()
  const chart = host.querySelector('.touch-pan-y') as HTMLElement
  const graph = host.querySelector('[data-ui="ProGraphGsc"]')!.parentElement!
  chart.getBoundingClientRect = graph.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect
  const pointer = (target: EventTarget, type: string, x: number) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { button: 0, clientX: x, clientY: 0, pointerId: 1, pointerType: 'mouse' })
    target.dispatchEvent(event)
  }
  expect(host.querySelector('[data-axis]')?.textContent).toContain('19 Thu')
  pointer(graph, 'pointermove', 600)
  await nextTick()
  expect(host.querySelector('.absolute.top-1')?.textContent).toContain('Thu, Nov 19, 2026')
  expect(host.querySelector('.absolute.bottom-9')?.textContent?.trim()).toBe('Thu, Nov 19, 2026')
  expect(host.textContent).toContain('Thu, Nov 12, 2026')
  expect(host.textContent).toContain('Nov 13 → Nov 19')
  pointer(chart, 'pointerdown', 200)
  pointer(window, 'pointermove', 600)
  await new Promise(resolve => requestAnimationFrame(resolve))
  await nextTick()
  expect(Array.from(host.querySelectorAll('.absolute.bottom-9'), el => el.textContent?.trim())).toEqual(['Nov 15', 'Nov 19'])
  expect(host.textContent).toContain('5 days')
  pointer(window, 'pointerup', 600)
  await nextTick()
  expect(zoom).toHaveBeenCalledWith({ start: '2026-11-15', end: '2026-11-19', prevStart: '2026-11-08', prevEnd: '2026-11-12' })
})
