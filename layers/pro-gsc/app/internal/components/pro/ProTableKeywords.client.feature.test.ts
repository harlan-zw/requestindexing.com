import { afterEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, ref, toValue } from 'vue'
import ProTableKeywords from './ProTableKeywords.vue'

const googleSlice = ref<{ googleBrand: string } | null>({ googleBrand: 'BRANDED' })
const cellReads: string[][] = []
const filters = {
  googleSlice,
  stableData: ref(true),
  compareMode: ref('previous'),
  columns: ref(['clicks']),
  brand: ref(''),
  questions: ref(''),
  selectGoogleBrand: () => { googleSlice.value = null },
}
vi.mock('nuxt/app', () => ({ useRoute: () => ({ params: { id: 's_app' } }) }))
vi.mock('../../../composables/useProGscFilters', () => ({ useProGscFilters: () => filters, buildBrandFacet: () => null, buildQuestionFacet: () => null }))
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
    rows: ref([{ queryCanonical: 'example', clicks: 42, impressions: 100, ctr: 0.42, position: 0 }]),
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
  setup: props => () => h('table', (props.tableData as object[]).map(original => h('tr', (props.columns as { cell: (ctx: unknown) => unknown }[]).map(column => h('td', column.cell({ row: { original } }) as never))))),
}) }))
let app: ReturnType<typeof createApp>
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  cellReads.length = 0
})

it('renders classified ranking with explicit unavailability and no broken query actions', async () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(ProTableKeywords, { siteId: 's_app', gscdumpSiteId: 's_engine' })
  app.component('UiButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  expect(host.textContent).toContain('example')
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
})
