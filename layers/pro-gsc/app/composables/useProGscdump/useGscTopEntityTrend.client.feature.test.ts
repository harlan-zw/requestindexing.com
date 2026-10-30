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

beforeEach(() => {
  reads.length = 0
  filters.searchType.value = 'web'
  filters.compareMode.value = 'previous'
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input), 'https://example.test').pathname
    const body = JSON.parse(String(init?.body)) as { state?: { dimensions: string[], searchType: string, filter: unknown }, dimensions: string[], searchType: string, filter: unknown }
    const state = body.state ?? body
    reads.push({ path, state })
    const rows = path.endsWith('/reports')
      ? [{ queryCanonical: 'Nuxt SEO', queryCanonicalKey: 'nuxt seo', clicks: 9, impressions: 90, ctr: 0.1, position: 3 }]
      : state.dimensions.includes('queryCanonical')
        ? [{ queryCanonical: 'nuxt seo', date: '2026-10-20', clicks: 4, impressions: 40 }, { queryCanonical: 'nuxt seo', date: '2026-10-21', clicks: 5, impressions: 50 }]
        : [{ date: '2026-10-20', clicks: 6, impressions: 60 }, { date: '2026-10-21', clicks: 8, impressions: 80 }]
    return Response.json({ data: { rows, totalCount: 1, totals: { clicks: 9, impressions: 90, ctr: 0.1, position: 3 }, meta: reportMeta }, meta })
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
async function mount() {
  const siteId = ref('s_example')
  const range = ref({ start: '2026-10-20', end: '2026-10-21' })
  const metric = ref<'clicks' | 'impressions'>('clicks')
  const facets = ref<readonly GscFacet[]>([])
  const scope = effectScope()
  scopes.push(scope)
  const view = scope.run(() => useGscTopEntityTrend({ gscdumpSiteId: siteId, range, metric, dimension: 'query', facets }))!
  await settle()
  expect(view.error.value).toBeNull()
  expect(view.result.value.series).toEqual([
    { key: 'nuxt seo', label: 'Nuxt SEO', values: [4, 5], isOther: false },
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
