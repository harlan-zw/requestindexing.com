import { afterEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, effectScope, h, nextTick, reactive, ref, toValue, watchEffect } from 'vue'
import { periodToDateRange } from '#layers/pro-gsc/app/composables/useGscPeriod'
import { useProGscdumpDataDetail } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpDataDetail'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import { googleEntityFilter, readGoogleDashboardRows } from '#layers/pro-gsc/app/utils/google-dashboard-rows'
import Overview from './index.vue'
import Detail from './queries/[keyword].vue'

const reads = vi.hoisted(() => ({ calls: [] as string[] }))
const googleSlice = ref<any>({ searchType: 'web', googleBrand: 'BRANDED', countries: [], devices: [] })
const clear = vi.fn(() => {
  googleSlice.value = null
})
const row = { queryCanonical: 'example', clicks: 20, impressions: 100, ctr: 0.2, position: 2, variantCount: 2 }
const queryRows = ref<any[]>([row])
const route = reactive({ path: '/pro/dashboard/sites/one/search-console', params: { keyword: 'example' }, query: {} as Record<string, string> })
const states = new Map<string, ReturnType<typeof ref>>()
let sharedVisit = false
const detailScopes: ReturnType<typeof effectScope>[] = []
const readRows = vi.fn(async () => ({ rows: [{ date: '2026-10-20', clicks: 7, impressions: 70, ctr: 0.1, position: 3 }] }))
const readRecorded = vi.fn(async () => ({ daily: [], totals: { clicks: 100 } }))
vi.mock('nuxt/app', () => ({
  useRoute: () => route,
  navigateTo: vi.fn(),
  useState: (key: string, init: () => unknown) => {
    if (!states.has(key))
      states.set(key, ref(init()))
    return states.get(key)
  },
}))
vi.mock('#layers/pro-gsc/app/composables/useProFilterStore', () => ({ useProFilterStore: () => ({ read: (_key: string, fallback: unknown) => fallback, write: vi.fn() }) }))
vi.mock('#layers/pro-gsc/app/internal/composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => ref(0) }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({ queryAnalyticsRows: readRows, queryAnalyticsReportDetail: readRecorded }) }))
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
vi.mock('#layers/pro-gsc/app/composables/useProGscFilters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#layers/pro-gsc/app/composables/useProGscFilters')>()
  return {
    ...actual,
    useProGscFilters: () => sharedVisit ? actual.useProGscFilters() : ({ period: ref('28d'), columns: ref(['clicks']), stableData: ref(true), compareMode: ref('previous'), searchType: ref('web'), brand: ref(''), questions: ref(''), googleSlice, selectGoogleBrand: clear }),
  }
})
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
    return { rows: computed(() => {
      if (opts.dimension !== 'queryCanonical')
        return sharedVisit && opts.dimension === 'page' ? [{ page: 'https://example.com/shoes?size=2', clicks: 7, impressions: 70, position: 3 }] : []
      const pin = toValue(opts.facets)?.find((f: any) => f.column === 'queryCanonical')
      return pin ? queryRows.value.filter(r => r.queryCanonical === pin.value) : queryRows.value
    }), isInitialLoading: ref(false), setSort: vi.fn(), error: ref(null), response: ref({}) }
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
  useRoute: () => route,
  toValue,
  useNuxtQuery: () => ({ data: ref(null) }),
  useTeamPolicy: () => ({ can: () => true }),
  useSite: () => ({ siteId: ref('one'), site: ref({ url: 'https://example.com', teamId: 1 }), siteName: ref('example.com'), siteStatus: ref('success'), gscdumpSiteId: ref('s_engine'), isProcessing: ref(false), isReady: ref(true), isNotConnected: ref(false), isLifecycleSettled: ref(true), hold: ref(null), gscData: ref({}), gscStatusError: ref(null) }),
})
const apps: ReturnType<typeof createApp>[] = []
function mount(component: any) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(component)
  app.config.warnHandler = () => {}
  const passthrough = defineComponent({ props: ['title', 'label'], setup: (props, { slots }) => () => h('div', [props.title, props.label, slots.default?.(), slots.action?.(), slots.text?.()]) })
  for (const name of ['UiAlert', 'ProPageZone', 'ProSectionHeader', 'UiSectionHeader', 'UiTooltip', 'UiTableShell', 'UiTableTh', 'UiTableTd']) app.component(name, passthrough)
  app.component('UiEntitySummary', defineComponent({ props: ['value', 'tooltipDescription'], setup: (p, { slots }) => () => h('div', { 'data-summary': '', 'data-description': p.tooltipDescription }, [slots.heading?.(), p.value]) }))
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.component('NuxtLink', defineComponent({ props: ['to'], setup: (p, { slots }) => () => h('a', { href: p.to }, slots.default?.()) }))
  app.component('UiPopover', defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.component('ULink', defineComponent({ props: ['to'], setup: (p, { slots }) => () => h('a', { href: p.to }, slots.default?.()) }))
  app.component('UiDataList', defineComponent({ props: ['items', 'viewMoreTo'], setup: (p, { slots }) => () => h('div', [p.viewMoreTo ? h('a', { href: p.viewMoreTo }, 'View all') : null, ...(p.items as any[] ?? []).map(item => slots.default?.({ item }))]) }))
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
  queryRows.value = [row]
  detailScopes.splice(0).forEach(scope => scope.stop())
  states.clear()
  sharedVisit = false
  route.query = {}
  route.path = '/pro/dashboard/sites/one/search-console'
  readRows.mockClear()
  readRecorded.mockClear()
})

it.each([
  ['query row', '/queries/Cr%C3%A8me%20%2B%20Shoes', 'queryCanonical', 'Crème + Shoes'],
  ['page row', '/pages/https%3A%2F%2Fexample.com%2Fshoes%3Fsize%3D2', 'page', 'https://example.com/shoes?size=2'],
  ['queries View all', '/queries', null, null],
  ['pages View all', '/pages', null, null],
  ['countries View all', '/countries', null, null],
])('retains the shared Overview selection through %s and a fresh destination load', async (_label, suffix, column, value) => {
  sharedVisit = true
  const selection = { period: 'custom:2026-10-20:2026-10-21', country: 'usa', device: 'MOBILE' }
  route.query = { ...selection, q: 'unrelated table search' }
  queryRows.value = [{ ...row, queryCanonical: 'Crème + Shoes', clicks: 7 }]
  const host = mount(Overview)
  await nextTick()
  const path = `/pro/dashboard/sites/one/search-console${suffix}`
  const anchor = [...host.querySelectorAll('a')].find(a => new URL(a.href).pathname === path)!
  expect(anchor, `rendered ${_label}`).toBeDefined()
  const destination = new URL(anchor.href)
  expect(Object.fromEntries(destination.searchParams)).toEqual(selection)
  apps.splice(0).forEach(app => app.unmount())
  states.clear()
  route.path = destination.pathname
  route.query = Object.fromEntries(destination.searchParams)
  const scope = effectScope()
  detailScopes.push(scope)
  const detail = scope.run(() => {
    const active = useProGscFilters()
    return useProGscdumpDataDetail('s_engine', {
      searchType: active.searchType.value,
      range: periodToDateRange(active.period.value, active.stableData.value),
      comparisonRange: null,
      ...(column && value ? { pin: { column: column as 'queryCanonical' | 'page', value: decodeURIComponent(destination.pathname.split('/').at(-1)!) } } : {}),
    }, active.googleSlice)
  })!
  await vi.waitFor(() => expect(detail.data.value?.totals.clicks).toBe(7))
  expect(readRecorded).not.toHaveBeenCalled()
  expect(readRows).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
    filter: expect.objectContaining({
      _filters: expect.arrayContaining([
        { dimension: 'date', operator: 'between', expression: '2026-10-20', expression2: '2026-10-21' },
        ...(column && value ? [{ dimension: column === 'queryCanonical' ? 'query' : column, operator: 'equals', expression: value }] : []),
      ]),
      _nestedGroups: expect.arrayContaining([
        expect.objectContaining({ _filters: [{ dimension: 'country', operator: 'equals', expression: 'usa' }] }),
        expect.objectContaining({ _filters: [{ dimension: 'device', operator: 'equals', expression: 'MOBILE' }] }),
      ]),
    }),
  }) }), true)
})

it.each(['country', 'device', 'classification'])('labels separate live spellings and their exact clicks as raw queries with %s filters', async (filter) => {
  const slice = { searchType: 'web' as const, googleBrand: filter === 'classification' ? 'BRANDED' as const : '' as const, countries: filter === 'country' ? ['usa'] : [], devices: filter === 'device' ? ['MOBILE' as const] : [] }
  googleSlice.value = slice
  // The recorded group has two spellings. Google returns their individual metrics.
  queryRows.value = await readGoogleDashboardRows(async () => [
    { query: 'example', clicks: 20, impressions: 100, position: 2, ctr: 0.2 },
    { query: 'examples', clicks: 7, impressions: 35, position: 3, ctr: 0.2 },
  ], slice, { range: { start: '2026-10-20', end: '2026-10-21' }, dimensions: ['query'] })
  const host = mount(Overview)
  await nextTick()
  expect(host.textContent).toContain('Raw queries')
  const ranking = host.querySelector('[tooltip*="Raw queries"]')!
  expect(ranking.getAttribute('tooltip')).toContain('Each spelling has its own metrics.')
  expect(ranking.textContent).toContain('example')
  expect(ranking.textContent).toContain('examples')
  expect(ranking.textContent).toContain('20')
  expect(ranking.textContent).toContain('7')
  expect(host.querySelector('[aria-label="Show 2 grouped variants"]')).toBeNull()
  if (filter === 'classification')
    return
  expect(googleEntityFilter(slice, 'queryCanonical', 'example')).toEqual({ dimension: 'query', operator: 'equals', expression: 'example' })
  const detail = mount(Detail)
  await nextTick()
  const summary = detail.querySelector('[data-summary]')!
  expect(summary.textContent).toContain('Raw query')
  expect(summary.textContent).toContain('20')
  expect(summary.getAttribute('data-description')).toBe('Clicks for this exact query spelling from Google Search in the selected period.')
  expect(detail.textContent).not.toContain('2 variants')
  googleSlice.value = null
  queryRows.value = [{ ...row, clicks: 27 }]
  await nextTick()
  expect(summary.textContent).toContain('27')
  expect(summary.getAttribute('data-description')).toContain('including every grouped variant')
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
