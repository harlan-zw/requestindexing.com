import type { AnalyticsRowsV1Request } from '@gscdump/contracts/v1/http'
import type { GoogleSearchSlice } from '../layers/pro-gsc/app/utils/google-search-slice'
import type { BreakdownInput } from '../layers/pro-gsc/shared/analytics-requests'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, toValue } from 'vue'
import { useGscTopEntityTrend } from '../layers/pro-gsc/app/composables/useProGscdump/useGscTopEntityTrend'
import { useProEntitySparklines } from '../layers/pro-gsc/app/composables/useProGscdump/useProEntitySparklines'
import { useProGscdumpData } from '../layers/pro-gsc/app/composables/useProGscdump/useProGscdumpData'
import { useProGscdumpDataDetail } from '../layers/pro-gsc/app/composables/useProGscdump/useProGscdumpDataDetail'
import { useProGscdumpTableData } from '../layers/pro-gsc/app/composables/useProGscdump/useProGscdumpTableData'
import { useProGscFilters } from '../layers/pro-gsc/app/composables/useProGscFilters'

const route = reactive({ path: '/pro/dashboard/sites/app/search-console/pages', query: { country: 'usa', device: 'MOBILE' } as Record<string, string> })
const states = new Map<string, ReturnType<typeof ref>>()
function state(key: string, init: () => unknown) {
  if (!states.has(key))
    states.set(key, ref(init()))
  return states.get(key)!
}
vi.mock('nuxt/app', () => ({ useRoute: () => route, navigateTo: vi.fn(), useState: (key: string, init: () => unknown) => state(key, init) }))
vi.mock('../layers/pro-gsc/app/composables/useProFilterStore', () => ({ useProFilterStore: () => ({ read: (_key: string, fallback: unknown) => fallback, write: vi.fn() }) }))
vi.mock('../layers/pro-gsc/app/composables/useGscComparisonCoverage', () => ({ useGscComparisonCoverage: () => ({ allowed: ref(true), state: ref('allowed') }) }))
vi.mock('../layers/pro-gsc/app/internal/composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => ref(0) }))
vi.mock('../layers/pro-gsc/app/composables/useGscQueryIdentity', () => ({ useGscQueryIdentity: () => ref({ _tag: 'Available', scope: 'fixture' }) }))
let rows: Record<string, unknown>[] = []
let trend = false
const requests: AnalyticsRowsV1Request[] = []
let beforeRead: ((signal?: AbortSignal) => Promise<void>) | undefined
interface WireFilter {
  dimension?: string
  operator?: string
  expression?: string
  _groupType?: string
  _filters?: readonly WireFilter[]
  _nestedGroups?: readonly WireFilter[]
}
function matching(filter: WireFilter | undefined, row: Record<string, unknown>): boolean {
  if (!filter)
    return true
  if (filter.dimension) {
    if (filter.dimension === 'date')
      return true
    const value = String(row[filter.dimension] ?? '')
    if (filter.operator === 'equals')
      return value.toLowerCase() === filter.expression?.toLowerCase()
    if (filter.operator === 'contains')
      return value.toLowerCase().includes(filter.expression?.toLowerCase() ?? '')
    if (filter.operator === 'includingRegex')
      return new RegExp(filter.expression ?? '', 'i').test(value)
    return true
  }
  const parts = [...(filter._filters ?? []), ...(filter._nestedGroups ?? [])]
  return filter._groupType === 'or' ? parts.some(part => matching(part, row)) : parts.every(part => matching(part, row))
}
vi.mock('../layers/pro-gsc/app/composables/useProGscdump/useProGscdump', () => ({ useProGscdump: () => ({
  queryAnalyticsRows: async ({ body }: { body: AnalyticsRowsV1Request }, _silent: boolean, transport?: { signal?: AbortSignal }) => {
    requests.push(body)
    await beforeRead?.(transport?.signal)
    if (trend && !body.dimensions?.includes('date'))
      return { rows: [row('shown', 9)] }
    if (trend && body.dimensions?.length === 1)
      return { rows: [{ date: '2026-10-20', clicks: 6 }, { date: '2026-10-21', clicks: 8 }] }
    return { rows: rows.filter(row => matching(body.filter, row)).slice(body.startRow ?? 0, (body.startRow ?? 0) + (body.rowLimit ?? 1000)) }
  },
}) }))
const scopes: ReturnType<typeof effectScope>[] = []
function run<T>(fn: () => T) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(fn)!
}
async function settle() {
  for (let i = 0; i < 40; i++) {
    await nextTick()
    await Promise.resolve()
  }
}
beforeEach(() => {
  states.clear()
  requests.length = 0
  rows = []
  trend = false
  beforeRead = undefined
  route.path = '/pro/dashboard/sites/app/search-console/pages'
  route.query = { country: 'usa', device: 'MOBILE' }
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('computed', computed)
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})
const range = { start: '2026-10-20', end: '2026-10-21' }
const slice: GoogleSearchSlice = { searchType: 'web', countries: ['usa'], devices: ['MOBILE'], googleBrand: '' }
function row(query: string, clicks = 4) {
  return { query, clicks, impressions: 40, ctr: 0.1, position: 3, country: 'usa', device: 'MOBILE' }
}

it('finds a country-filtered query ranked below the unsearched first page', async () => {
  rows = Array.from({ length: 26 }, (_, index) => row(index === 25 ? 'needle' : `query ${index}`, 100 - index))
  const view = run(() => useProGscdumpData('engine', { searchType: 'web', dimension: 'queryCanonical', range, comparisonRange: null, search: 'needle', rowLimit: 25, orderBy: { column: 'clicks', dir: 'desc' } }, { googleSlice: slice }))
  await settle()
  expect(view.data.value?.rows.map(row => row.queryCanonical)).toEqual(['needle'])
  expect(requests).toHaveLength(1)
  expect(requests[0]?.filter?._filters).toContainEqual({ dimension: 'query', operator: 'contains', expression: 'needle' })
})

it.each([
  { dimension: 'country', search: 'us', selected: 'usa' },
  { dimension: 'device', search: 'mob', selected: 'MOBILE' },
] as const)('narrows selected $dimension values inside one Google list', async ({ dimension, search, selected }) => {
  rows = [row('match'), { ...row('other'), country: 'gbr', device: 'DESKTOP' }]
  const view = run(() => useProGscdumpData('engine', { searchType: 'web', dimension, range, comparisonRange: null, search, rowLimit: 25 }, { googleSlice: { ...slice, countries: ['usa', 'gbr'], devices: ['MOBILE', 'DESKTOP'] } }))
  await settle()
  expect(view.data.value?.rows).toHaveLength(1)
  expect(view.data.value?.rows[0]).toHaveProperty(dimension, selected)
  expect(requests).toHaveLength(1)
  expect(requests[0]?.filter?._filters.some(filter => filter.dimension === dimension)).toBe(false)
})

it('omits the Google read when a search excludes every selected country', async () => {
  const view = run(() => useProGscdumpData('engine', { searchType: 'web', dimension: 'country', range, comparisonRange: null, search: 'gbr', rowLimit: 25 }, { googleSlice: slice }))
  await settle()
  expect(view.data.value?.rows).toEqual([])
  expect(requests).toHaveLength(0)
})

it('reports an incomplete classified query search when the read budget runs out', async () => {
  rows = Array.from({ length: 10_000 }, (_, index) => ({ ...row(`query ${index}`), brandedClassification: 'BRANDED' }))
  const view = run(() => useProGscdumpData('engine', { searchType: 'web', dimension: 'queryCanonical', range, comparisonRange: null, search: 'never matches', rowLimit: 25 }, { googleSlice: { ...slice, googleBrand: 'BRANDED' } }))
  await vi.waitFor(() => expect(view.error.value?.message).toBe('Search results incomplete. Select a shorter date range.'))
  expect(requests).toHaveLength(4)
  expect(view.data.value).toBeNull()
})

it('stops a classified query search when its input changes', async () => {
  rows = Array.from({ length: 3_000 }, (_, index) => ({ ...row(`query ${index}`), brandedClassification: 'BRANDED' }))
  const pausedRead = Promise.withResolvers<void>()
  let oldSignal: AbortSignal | undefined
  beforeRead = (signal) => {
    if (requests.length === 1) {
      oldSignal = signal
      return pausedRead.promise
    }
    return Promise.resolve()
  }
  const input = ref<BreakdownInput>({ searchType: 'web', dimension: 'queryCanonical', range, comparisonRange: null, search: 'never matches', rowLimit: 25 })
  const view = run(() => useProGscdumpData('engine', input, { googleSlice: { ...slice, googleBrand: 'BRANDED' } }))
  input.value = { ...input.value, search: undefined }
  await settle()
  pausedRead.resolve()
  await settle()
  expect(oldSignal?.aborted).toBe(true)
  expect(requests).toHaveLength(2)
  expect(view.data.value?.rows).toHaveLength(25)
})
it('reports comparison unavailability for a country-filtered Improving deep link', async () => {
  rows = [row('growing', 20)]
  const view = run(() => useProGscdumpTableData({ siteId: 'engine', dimension: 'queryCanonical', period: '7d', compareMode: 'previous', defaultFilter: 'improving' }))
  await settle()
  expect(view.data.value.comparisonRefused).toBe(true)
  expect(view.data.value.hasPrevData).toBe(false)
})
it('scopes sparkline reads to displayed keys beyond 25000 unrelated entity days', async () => {
  rows = [...Array.from({ length: 25001 }, (_, index) => ({ ...row(`unrelated ${index}`), date: '2026-10-20' })), { ...row('shown'), date: '2026-10-20' }, { ...row('shown', 5), date: '2026-10-21' }]
  const view = run(() => useProEntitySparklines({ gscdumpSiteId: 'engine', dimension: 'queryCanonical', range, keys: ['shown'] }))
  await settle()
  expect(view.map.value.get('shown')).toEqual([4, 5])
})
it('scopes stacked trend entity reads to its displayed keys', async () => {
  trend = true
  // The same live boundary supplies ranking, totals and entity-day rows.
  rows = [...Array.from({ length: 25001 }, (_, index) => ({ ...row(`unrelated ${index}`), date: '2026-10-20' })), { ...row('shown'), date: '2026-10-20' }, { ...row('shown', 5), date: '2026-10-21' }]
  const view = run(() => useGscTopEntityTrend({ gscdumpSiteId: 'engine', dimension: 'query', metric: 'clicks', range, topN: 1 }))
  await settle()
  expect(view.error.value).toBeNull()
  expect(view.result.value.series.find(series => series.key === 'shown')?.values).toEqual([4, 5])
})

it('keeps Mobile and the page pin in detail totals and daily series', async () => {
  const page = 'https://example.com/article'
  rows = [
    { ...row('shown', 10), page, date: '2026-10-20' },
    { ...row('shown', 90), page, device: 'DESKTOP', date: '2026-10-20' },
    { ...row('shown', 80), page: 'https://example.com/other', date: '2026-10-20' },
  ]
  const filters = run(() => useProGscFilters())
  route.path += '/https%3A%2F%2Fexample.com%2Farticle'
  const view = run(() => useProGscdumpDataDetail('engine', { searchType: 'web', range, comparisonRange: null, pin: { column: 'page', value: page } }, filters.googleSlice))
  await settle()
  expect(view.data.value?.totals.clicks).toBe(10)
  expect(view.data.value?.daily.map(day => day.clicks)).toEqual([10])
})

it('refuses a classified query pin instead of returning site-wide detail totals', async () => {
  rows = [{ ...row('unrelated', 100), date: '2026-10-20' }]
  const view = run(() => useProGscdumpDataDetail('engine', { searchType: 'web', range, comparisonRange: null, pin: { column: 'queryCanonical', value: 'shown' } }, { ...slice, googleBrand: 'BRANDED' }))
  await settle()
  expect(view.error.value?.message).toContain('Clear Google classification')
  expect(view.data.value).toBeNull()
  expect(requests).toEqual([])
})
it('keeps Mobile active when a Pages row opens its detail route', () => {
  const filters = run(() => useProGscFilters())
  expect(filters.googleSlice.value?.devices).toEqual(['MOBILE'])
  route.path = '/pro/dashboard/sites/app/search-console/pages/https%3A%2F%2Fexample.com'
  expect(filters.googleSlice.value?.devices).toEqual(['MOBILE'])
})
