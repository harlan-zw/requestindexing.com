import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, toValue, watchEffect } from 'vue'
import Overview from './index.vue'
import Detail from './queries/[keyword].vue'

const reads = vi.hoisted(() => ({ calls: [] as string[] }))
const googleSlice = ref<any>({ searchType: 'web', googleBrand: 'BRANDED', countries: [], devices: [] })
const clear = vi.fn(() => {
  googleSlice.value = null
})
const row = { queryCanonical: 'example', clicks: 20, impressions: 100, ctr: 0.2, position: 2, variantCount: 2 }
vi.mock('#components', () => ({
  NuxtLink: defineComponent({ props: ['to'], setup: (p, { slots }) => () => h('a', { href: p.to }, slots.default?.()) }),
  UiTooltip: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  UiPopover: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  UiIcon: defineComponent({ render: () => h('span') }),
  UiSkeleton: defineComponent({ render: () => h('span') }),
  UiSparkline: defineComponent({ render: () => h('span') }),
}))
vi.mock('#layers/pro-gsc/app/components/overview/ProSiteSetupOffers.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProCardGsc.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscReadError.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('#layers/pro-gsc/app/internal/components/pro/ProSparklineCell.vue', () => ({ default: defineComponent({ render: () => h('span', { 'data-spark': '' }) }) }))
vi.mock('#layers/pro-gsc/app/internal/components/pro/ProTablePages.vue', () => ({ default: defineComponent({
  props: ['gscdumpSiteId'],
  setup: (props) => {
    watchEffect(() => {
      if (props.gscdumpSiteId)
        reads.calls.push('pages')
    })
    return () => h('div', 'Ranking pages')
  },
}) }))
vi.mock('#layers/pro-gsc/app/composables/useGscQueryIdentity', () => ({ useGscQueryIdentity: () => ref({ _tag: 'Available', scope: 'one' }) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', () => ({
  useProGscFilters: () => ({ period: ref('28d'), columns: ref(['clicks']), stableData: ref(true), compareMode: ref('previous'), searchType: ref('web'), brand: ref(''), questions: ref(''), googleSlice, selectGoogleBrand: clear }),
  buildBrandFacet: () => null,
  buildQuestionFacet: () => null,
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProGscdumpDates: (site: any, _period: any, opts: any) => {
    watchEffect(() => {
      if (toValue(site) && toValue(opts?.filter))
        reads.calls.push('daily')
    })
    return { data: ref({ dates: [], period: { clicks: 20, impressions: 100, ctr: 0.2, position: 2 } }), status: ref('success'), error: ref(null) }
  },
  useProGscdumpTableData: (opts: any) => {
    watchEffect(() => {
      if (toValue(opts.siteId) && toValue(opts.facets)?.some((f: any) => f.column === 'queryCanonical'))
        reads.calls.push('pinned-table')
    })
    return { rows: ref(opts.dimension === 'queryCanonical' ? [row] : []), isInitialLoading: ref(false), setSort: vi.fn(), error: ref(null), response: ref({}) }
  },
  useProEntitySparklines: (opts: any) => {
    watchEffect(() => {
      if (toValue(opts.gscdumpSiteId) && opts.dimension === 'queryCanonical' && toValue(opts.keys).length)
        reads.calls.push('spark')
    })
    return { map: ref(new Map()), pending: ref(false), error: ref(null), dates: ref([]) }
  },
  useProGscdumpPeriodCount: () => ({ count: ref(1), isLoading: ref(false), error: ref(null) }),
  useProGscQueryVariants: () => ({ variantsFor: () => [], loadingFor: () => false, open: () => reads.calls.push('variants') }),
  useProQueryPositionSparklines: () => ({ seriesFor: () => [], datesFor: () => [], loadingFor: () => false, open: () => reads.calls.push('position') }),
}))
Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useRoute: () => ({ params: { keyword: 'example' } }),
  useNuxtQuery: () => ({ data: ref(null) }),
  useSite: () => ({ siteId: ref('one'), site: ref({ url: 'https://example.com' }), siteStatus: ref('success'), gscdumpSiteId: ref('s_engine'), isProcessing: ref(false), isReady: ref(true), isNotConnected: ref(false), isLifecycleSettled: ref(true), hold: ref(null), gscData: ref({}), gscStatusError: ref(null) }),
})
const apps: ReturnType<typeof createApp>[] = []
function mount(component: any) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(component)
  app.config.warnHandler = () => {}
  const passthrough = defineComponent({ props: ['title', 'label'], setup: (props, { slots }) => () => h('div', [props.title, props.label, slots.default?.(), slots.action?.(), slots.text?.()]) })
  for (const name of ['UiAlert', 'UiButton', 'ProPageZone', 'ProSectionHeader', 'UiTooltip', 'UiEntitySummary', 'UiTableShell', 'UiTableTh', 'UiTableTd']) app.component(name, passthrough)
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.component('NuxtLink', defineComponent({ props: ['to'], setup: (p, { slots }) => () => h('a', { href: p.to }, slots.default?.()) }))
  app.component('UiPopover', defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.component('UiDataList', defineComponent({ props: ['items'], setup: (p, { slots }) => () => h('div', (p.items as any[] ?? []).map(item => slots.default?.({ item }))) }))
  app.mount(host)
  apps.push(app)
  return host
}
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
  reads.calls = []
  googleSlice.value = { searchType: 'web', googleBrand: 'BRANDED', countries: [], devices: [] }
  clear.mockClear()
})
it('keeps classified Overview query metrics without failing links, variants, hover reads or inline trends', async () => {
  const host = mount(Overview)
  await nextTick()
  expect(host.textContent).toContain('example')
  expect(host.querySelector('a[href*="/queries/example"]')).toBeNull()
  host.querySelectorAll('.cursor-help').forEach(node => node.dispatchEvent(new Event('pointerenter')))
  await nextTick()
  expect(reads.calls).toEqual([])
  expect(host.querySelector('[data-spark]')).toBeNull()
  expect(host.textContent).toContain('Query details and trends are unavailable with Google classification.')
  expect(host.querySelector('[aria-label="Show 2 grouped variants"]')).toBeNull()
  host.querySelector('button')!.click()
  await nextTick()
  expect(host.querySelector('a[href*="/queries/example"]')).not.toBeNull()
  host.querySelectorAll('.cursor-help').forEach(node => node.dispatchEvent(new Event('pointerenter')))
  expect(reads.calls).toEqual(expect.arrayContaining(['spark', 'position']))
})
it('explains a classified detail URL before any pinned reads and recovers when classification clears', async () => {
  const host = mount(Detail)
  await nextTick()
  expect(reads.calls).toEqual([])
  expect(host.textContent).toContain('Query details and trends are unavailable with Google classification.')
  expect(host.textContent).toContain('All queries')
  host.querySelector('button')!.click()
  await nextTick()
  expect(clear).toHaveBeenCalledWith('')
  expect(reads.calls).toEqual(expect.arrayContaining(['daily', 'pinned-table', 'spark', 'pages']))
  googleSlice.value = { searchType: 'web', googleBrand: 'NON_BRANDED', countries: [], devices: [] }
  reads.calls = []
  await nextTick()
  expect(reads.calls).toEqual([])
  expect(host.textContent).not.toContain('Ranking pages')
})
