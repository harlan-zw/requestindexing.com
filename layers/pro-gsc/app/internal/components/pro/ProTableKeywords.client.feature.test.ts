import { afterEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, effectScope, h, nextTick, reactive, ref, toValue } from 'vue'
import { useProGscdumpDataDetail } from '../../../composables/useProGscdump/useProGscdumpDataDetail'
import { useProGscFilters } from '../../../composables/useProGscFilters'
import ProTableKeywords from './ProTableKeywords.vue'

const googleSlice = ref<{ googleBrand: string } | null>({ googleBrand: 'BRANDED' })
const cellReads: string[][] = []
const route = reactive({ params: { id: 's_app' }, path: '/pro/dashboard/sites/s_app/search-console/queries', query: {} as Record<string, string> })
const states = new Map<string, ReturnType<typeof ref>>()
let realFilters = false
const filters = {
  googleSlice,
  stableData: ref(true),
  compareMode: ref('previous'),
  columns: ref(['clicks']),
  brand: ref(''),
  questions: ref(''),
  selectGoogleBrand: () => { googleSlice.value = null },
}
vi.mock('nuxt/app', () => ({
  useRoute: () => route,
  navigateTo: vi.fn(),
  useState: (key: string, init: () => unknown) => {
    if (!states.has(key))
      states.set(key, ref(init()))
    return states.get(key)
  },
}))
vi.mock('../../../composables/useProGscFilters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../composables/useProGscFilters')>()
  return { ...actual, useProGscFilters: () => realFilters ? actual.useProGscFilters() : filters }
})
vi.mock('../../../composables/useProFilterStore', () => ({ useProFilterStore: () => ({ read: (_key: string, fallback: unknown) => fallback, write: vi.fn() }) }))
vi.mock('../../composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => ref(0) }))
vi.mock('../../../composables/useGscQueryIdentity', () => ({ useGscQueryIdentity: () => ref({ _tag: 'Available', scope: 'fixture' }) }))
const readRows = vi.fn(async (_request: unknown, _silent: boolean) => ({ rows: [{ date: '2026-10-20', clicks: 7, impressions: 70, ctr: 0.1, position: 3 }] }))
const readRecordedDetail = vi.fn(async () => ({ daily: [], totals: { clicks: 100 } }))
vi.mock('../../../composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({ queryAnalyticsRows: readRows, queryAnalyticsReportDetail: readRecordedDetail }) }))
vi.mock('../../composables/useGscBackfill', () => ({ useGscBackfill: () => ({ maybeTrigger: vi.fn() }) }))
vi.mock('../../../composables/useProGscdump', () => ({
  useProGscdumpTableData: () => ({
    q: ref(''),
    page: ref(1),
    filter: ref(''),
    sort: ref({ column: 'clicks', direction: 'desc' }),
    isLoading: ref(false),
    isLoadingMore: ref(false),
    error: ref(null),
    rows: computed(() => [{ queryCanonical: realFilters ? 'Crème + Shoes' : 'example', clicks: 42, impressions: 100, ctr: 0.42, position: 0 }]),
    total: ref(1),
    loadedCount: ref(1),
    hasMore: ref(false),
    data: ref({ totalClicks: 42, hasPrevData: false }),
  }),
  useProGscQueryVariants: () => ({ variantsFor: () => [], loadingFor: () => false }),
  useProTopAssociations: (opts: { keys: unknown }) => {
    cellReads.push(computed(() => toValue(opts.keys)).value as string[])
    return { map: ref(new Map()), pending: ref(false) }
  },
  useProEntitySparklines: (opts: { keys: unknown }) => {
    cellReads.push(computed(() => toValue(opts.keys)).value as string[])
    return { map: ref(new Map()), pending: ref(false), error: ref(null), dates: ref([]) }
  },
}))
vi.mock('#components', () => {
  const slot = defineComponent({ setup: (_, { slots }) => () => h('span', slots.default?.()) })
  return { UiProgressPercent: slot, UiTableDash: slot, UiTableMetricCell: slot, UiTableTrendCell: slot, UiTrend: slot }
})
vi.mock('../../../components/pro/ProQueryLabel.vue', () => ({ default: defineComponent({
  props: ['keyword', 'to'],
  setup: props => () => h(props.to ? 'a' : 'span', props.to ? { href: props.to } : {}, props.keyword),
}) }))
vi.mock('./ProSparklineCell.vue', () => ({ default: defineComponent({ render: () => h('button', { 'data-sparkline': '' }, 'Trend') }) }))
vi.mock('./ProTopPageCell.vue', () => ({ default: defineComponent({ render: () => h('span', 'Top page') }) }))
vi.mock('../../../components/pro/ProGscTableShell.vue', () => ({ default: defineComponent({
  inheritAttrs: false,
  props: ['columns', 'tableData'],
  setup: props => () => h('table', [h('thead', (props.columns as { header: string }[]).map(column => h('th', column.header))), ...(props.tableData as object[]).map(original => h('tr', (props.columns as { cell: (ctx: unknown) => unknown }[]).map(column => h('td', column.cell({ row: { original } }) as never))))]),
}) }))
let app: ReturnType<typeof createApp>
let detailScope = effectScope()
afterEach(() => {
  app?.unmount()
  detailScope.stop()
  states.clear()
  realFilters = false
  route.query = {}
  readRows.mockClear()
  readRecordedDetail.mockClear()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  cellReads.length = 0
})

it('keeps the exact raw query and shared country and device filters after following a row and reloading', async () => {
  realFilters = true
  route.query = { country: 'usa', device: 'MOBILE' }
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(ProTableKeywords, { siteId: 's_app', gscdumpSiteId: 's_engine' })
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  const destination = new URL(host.querySelector('a')!.getAttribute('href')!, 'https://requestindexing.com')
  app.unmount()
  states.clear()
  route.path = destination.pathname
  route.query = Object.fromEntries(destination.searchParams)
  await nextTick()
  detailScope = effectScope()
  vi.stubGlobal('toValue', toValue)
  const detail = detailScope.run(() => {
    const active = useProGscFilters()
    return useProGscdumpDataDetail('s_engine', {
      searchType: 'web',
      range: { start: '2026-10-20', end: '2026-10-21' },
      comparisonRange: null,
      pin: { column: 'queryCanonical', value: decodeURIComponent(destination.pathname.split('/').at(-1)!) },
    }, active.googleSlice)
  })!
  await vi.waitFor(() => expect(detail.data.value?.totals.clicks).toBe(7))
  expect(readRecordedDetail).not.toHaveBeenCalled()
  expect(readRows).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
    filter: expect.objectContaining({
      _filters: expect.arrayContaining([{ dimension: 'query', operator: 'equals', expression: 'Crème + Shoes' }]),
      _nestedGroups: expect.arrayContaining([
        expect.objectContaining({ _filters: [{ dimension: 'country', operator: 'equals', expression: 'usa' }] }),
        expect.objectContaining({ _filters: [{ dimension: 'device', operator: 'equals', expression: 'MOBILE' }] }),
      ]),
    }),
  }) }), true)
})

it('renders classified ranking with explicit unavailability and no broken query actions', async () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(ProTableKeywords, { siteId: 's_app', gscdumpSiteId: 's_engine' })
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  expect(host.textContent).toContain('example')
  expect(host.querySelector('th')?.textContent).toBe('Raw query')
  expect(host.textContent).toContain('Query details and trends are unavailable with Google classification.')
  expect(host.querySelector('a')).toBeNull()
  expect(host.querySelector('[data-sparkline]')).toBeNull()
  expect(cellReads).toEqual([[], []])
  expect(host.textContent).not.toContain('Retry')
  const clear = [...host.querySelectorAll('button')].find(button => button.textContent?.trim() === 'All queries')!
  clear.click()
  await nextTick()
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/pro/dashboard/sites/s_app/search-console/queries/example')
  expect(host.querySelector('[data-sparkline]')).not.toBeNull()
  expect(host.querySelector('th')?.textContent).toBe('Query')
})
