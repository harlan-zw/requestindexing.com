import type { GscSearchType } from '@gscdump/contracts'
import type { GscFacet } from '../../../shared/utils/gsc-facets'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useGscTopEntityTrend } from './useGscTopEntityTrend'

const filters = { searchType: ref<GscSearchType>('web'), compareMode: ref('previous') }
vi.mock('../useProGscFilters', () => ({ useProGscFilters: () => filters }))

const reads: Array<{ path: string, state: { dimensions: string[], searchType: string, filter: unknown } }> = []
const scopes: Array<ReturnType<typeof effectScope>> = []
const meta = { requestId: 'req_trend', surface: 'analytics', version: '1.0', sourceName: 'hosted-trend', sourceKind: 'sql', queryMs: 0 }
const reportMeta = { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-21', oldestDateSynced: '2026-09-25', dataDelay: '3 days' }
type ReadStage = 'ranking' | 'daily'
const heldReads: Array<{ stage: ReadStage, intercept: (response: Response) => Promise<Response> }> = []

function holdNext(stage: ReadStage) {
  const deferred = Promise.withResolvers<Response>()
  let reply: Response | undefined
  heldReads.push({ stage, intercept: (response) => {
    reply = response
    return deferred.promise
  } })
  return {
    succeed: () => {
      if (!reply)
        throw new Error('The held request has not started.')
      deferred.resolve(reply)
    },
    fail: () => deferred.resolve(Response.json({ error: { code: 'invalid_request', message: 'The held request failed.', requestId: 'req_held', retryable: false, details: {} } }, { status: 400 })),
  }
}

beforeEach(() => {
  reads.length = 0
  heldReads.length = 0
  filters.searchType.value = 'web'
  filters.compareMode.value = 'previous'
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input), 'https://example.test').pathname
    const body = JSON.parse(String(init?.body)) as { state?: { dimensions: string[], searchType: string, filter: unknown }, dimensions: string[], searchType: string, filter: unknown }
    const state = body.state ?? body
    reads.push({ path, state })
    const dimension = state.dimensions.find(value => value !== 'date') ?? 'queryCanonical'
    const key = dimension === 'page' ? 'https://example.com/page' : 'nuxt seo'
    const identity = { [dimension]: dimension === 'queryCanonical' ? 'Nuxt SEO' : key, ...(dimension === 'queryCanonical' ? { queryCanonicalKey: key } : {}) }
    const rows = path.endsWith('/reports')
      ? [{ ...identity, clicks: 9, impressions: 90, ctr: 0.1, position: 3 }]
      : state.dimensions.some(value => value !== 'date')
        ? [{ [dimension]: key, date: '2026-10-20', clicks: 4, impressions: 40 }, { [dimension]: key, date: '2026-10-21', clicks: 5, impressions: 50 }]
        : [{ date: '2026-10-20', clicks: 6, impressions: 60 }, { date: '2026-10-21', clicks: 8, impressions: 80 }]
    const response = Response.json({ data: { rows, totalCount: 1, totals: { clicks: 9, impressions: 90, ctr: 0.1, position: 3 }, meta: reportMeta }, meta })
    const stage = path.endsWith('/reports') ? 'ranking' : 'daily'
    const heldIndex = heldReads.findIndex(read => read.stage === stage)
    return heldIndex < 0 ? response : heldReads.splice(heldIndex, 1)[0]!.intercept(response)
  })
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})
async function settle() {
  for (let index = 0; index < 30; index++)
    await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
async function mount(dimension: 'query' | 'page' = 'query') {
  const siteId = ref('s_example')
  const range = ref({ start: '2026-10-20', end: '2026-10-21' })
  const metric = ref<'clicks' | 'impressions'>('clicks')
  const facets = ref<readonly GscFacet[]>([])
  const scope = effectScope()
  scopes.push(scope)
  const view = scope.run(() => useGscTopEntityTrend({ gscdumpSiteId: siteId, range, metric, dimension, facets }))!
  await settle()
  expect(view.error.value).toBeNull()
  expect(view.result.value.series).toEqual([
    { key: dimension === 'page' ? 'https://example.com/page' : 'nuxt seo', label: dimension === 'page' ? 'https://example.com/page' : 'Nuxt SEO', values: [4, 5], isOther: false },
    { key: '__other__', label: 'All Others', values: [2, 3], isOther: true },
  ])
  return { view, siteId, range, metric, facets }
}

it.each(['range', 'facets'] as const)('retains its answered trend after an equivalent %s replacement', async (input) => {
  const { view, range, facets } = await mount()
  expect(reads).toHaveLength(3)
  if (input === 'range')
    range.value = { start: range.value.start, end: range.value.end }
  else
    facets.value = []
  await settle()
  expect(reads).toHaveLength(3)
  expect(view.result.value.series[0]?.values).toEqual([4, 5])
})

it('keeps current-only trend reads independent of the page comparison', async () => {
  await mount()
  filters.compareMode.value = 'none'
  await settle()
  expect(reads).toHaveLength(3)
})

it('replaces the answered trend after a real request input changes', async () => {
  const { view, metric } = await mount()
  metric.value = 'impressions'
  await settle()
  expect(reads).toHaveLength(6)
  expect(view.result.value.series[0]?.values).toEqual([40, 50])
})

it('observes changed dates, Site identity, search type and nested facet values', async () => {
  const { range, siteId, facets } = await mount()
  range.value = { start: '2026-10-19', end: range.value.end }
  await settle()
  expect(reads).toHaveLength(6)
  siteId.value = 's_other'
  await settle()
  expect(reads).toHaveLength(9)
  expect(reads.slice(-3).every(read => read.path.includes('/sites/s_other/'))).toBe(true)
  filters.searchType.value = 'image'
  await settle()
  expect(reads).toHaveLength(12)
  expect(reads.slice(-3).every(read => read.state.searchType === 'image')).toBe(true)
  const country = reactive({ column: 'country' as const, op: 'eq' as const, value: 'aus' })
  facets.value = [country]
  await settle()
  expect(reads).toHaveLength(15)
  country.value = 'usa'
  await settle()
  expect(reads).toHaveLength(18)
})

it.each([
  ['query', 'ranking'],
  ['query', 'daily'],
  ['page', 'ranking'],
  ['page', 'daily'],
] as const)('retains an answered %s trend when an older %s read fails', async (dimension, stage) => {
  const { view, metric } = await mount(dimension)
  const previous = holdNext(stage)
  metric.value = 'impressions'
  await settle()
  metric.value = 'clicks'
  await settle()
  expect(view.result.value.series[0]?.values).toEqual([4, 5])

  previous.fail()
  await settle()
  expect(view.error.value).toBeNull()
  expect(view.pending.value).toBe(false)
  expect(view.result.value.series[0]?.values).toEqual([4, 5])
})

it.each([
  ['ranking', 'succeed'],
  ['ranking', 'fail'],
  ['daily', 'succeed'],
  ['daily', 'fail'],
] as const)('keeps a newer read pending when an older %s read ends with %s', async (stage, outcome) => {
  const { view, metric } = await mount()
  const previous = holdNext(stage)
  metric.value = 'impressions'
  await settle()
  const latest = holdNext('ranking')
  metric.value = 'clicks'
  await settle()
  expect(view.pending.value).toBe(true)
  const readCount = reads.length

  previous[outcome]()
  await settle()
  expect(view.pending.value).toBe(true)
  expect(view.error.value).toBeNull()
  expect(reads).toHaveLength(readCount)

  latest.succeed()
  await settle()
  expect(view.pending.value).toBe(false)
  expect(view.result.value.series[0]?.values).toEqual([4, 5])
})

it.each(['ranking', 'daily'] as const)('surfaces a current %s read failure and clears loading', async (stage) => {
  const { view, metric } = await mount()
  const latest = holdNext(stage)
  metric.value = 'impressions'
  await settle()
  latest.fail()
  await settle()
  expect(view.pending.value).toBe(false)
  expect(view.error.value).toBeInstanceOf(Error)
  expect(view.result.value.series).toEqual([])
})
