import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref, useId } from 'vue'
import UiSkeleton from '#layers/design-system/app/components/element/UiSkeleton.vue'
import { gscMetricColors } from '#layers/design-system/app/composables/dataVizColors'
import ProCardGsc from './ProCardGsc.vue'

vi.mock('../../composables/useProGscFilters', () => ({ useProGscFilters: () => ({ period: ref('28d'), compareMode: ref('previous'), stableData: ref(false) }) }))
vi.mock('./ProGraphGsc.vue', () => ({ default: { render: () => h('div') } }))
let app: ReturnType<typeof createApp> | undefined
afterEach(() => {
  app?.unmount()
  vi.unstubAllGlobals()
})
it('escape cancels pending animation and cannot commit the abandoned selection', async () => {
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('useId', useId)
  vi.stubGlobal('useProDevSkeleton', () => ref(false))
  vi.stubGlobal('useProHumanFriendlyNumber', (value: number) => String(value))
  const frames = new Map<number, FrameRequestCallback>()
  let frame = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frame, callback)
    return frame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const flush = () => {
    for (const [id, callback] of frames) {
      frames.delete(id)
      callback(0)
    }
  }
  const zoom = vi.fn()
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03'].map(date => ({ date, clicks: 1, impressions: 10, ctr: 0.1, position: 2 }))
  app = createApp(ProCardGsc, { dates, prevDates: null, period: null, prevPeriod: null, onZoom: zoom })
  const pass = defineComponent({
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
  for (const name of ['UiPopover', 'ClientOnly', 'UiSparkline', 'UiTrend', 'UiSkeleton', 'UIcon', 'UiIcon', 'ProFavicon'])
    app.component(name, pass)
  const host = document.createElement('div')
  app.mount(host)
  await nextTick()
  const chart = host.querySelector('.touch-pan-y') as HTMLElement
  chart.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  const pointer = (target: EventTarget, type: string, x: number) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { button: 0, clientX: x, clientY: 0, pointerId: 1, pointerType: 'mouse' })
    target.dispatchEvent(event)
  }
  pointer(chart, 'pointerdown', 0)
  pointer(window, 'pointermove', 60)
  flush()
  pointer(window, 'pointermove', 100)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  flush()
  pointer(window, 'pointerup', 100)
  expect(zoom).not.toHaveBeenCalled()
  expect(document.documentElement.style.userSelect).not.toBe('none')
})

it('keeps known totals during refresh and explains a failed comparison', async () => {
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('useId', useId)
  vi.stubGlobal('useProDevSkeleton', () => ref(false))
  vi.stubGlobal('useProHumanFriendlyNumber', (value: number) => String(value))
  const period = { clicks: 42, impressions: 100, ctr: 0.42, position: 3 }
  const props = ref({
    dates: [{ date: '2026-10-23', ...period }],
    prevDates: null,
    period: period as typeof period | null,
    prevPeriod: null,
    loading: true,
    comparisonReadFailed: false,
    columns: ['clicks'],
    showButtons: true,
  })
  app = createApp({ setup: () => () => h(ProCardGsc, props.value) })
  Object.assign(app.config.globalProperties, { gscMetricColors, useProHumanFriendlyNumber: (value: number) => String(value) })
  const pass = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['UiPopover', 'ClientOnly', 'UiSparkline', 'UiTrend', 'UIcon', 'UiIcon', 'ProFavicon'])
    app.component(name, pass)
  app.component('UiSkeleton', UiSkeleton)
  const host = document.createElement('div')
  app.mount(host)
  await nextTick()
  expect(host.textContent).toContain('42')
  expect(host.querySelectorAll('.ui-skeleton')).toHaveLength(0)
  props.value = { ...props.value, loading: false, comparisonReadFailed: true }
  await nextTick()
  expect(host.querySelector('[role="status"]')?.textContent?.trim()).toBe('Comparison data could not load. Growth values are hidden. Reload to try again.')
  expect(host.textContent).toContain('42')
  props.value = { ...props.value, dates: [], period: null, loading: true }
  await nextTick()
  expect(host.querySelectorAll('.ui-skeleton').length).toBeGreaterThan(0)
})
