import type { BreakdownInput, DailyReportInput } from '../../../shared/analytics-requests'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, toValue } from 'vue'
import { useProGscdumpData } from './useProGscdumpData'
import { useProGscdumpDataDetail } from './useProGscdumpDataDetail'

let scope: ReturnType<typeof effectScope>
const reads: Array<{ path: string, body: Record<string, unknown>, reply: (value: Response) => void }> = []
beforeEach(() => {
  scope = effectScope()
  reads.length = 0
  const caller = ref({
    user: { id: 1, name: 'First', email: null, avatarUrl: null, providers: [], createdAt: null },
    currentTeamId: 10,
    isAdmin: false,
    memberships: [{ teamId: 10, teamName: 'Personal', role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
  })
  const invalidation = ref({})
  vi.stubGlobal('useNuxtData', () => ({ data: caller }))
  vi.stubGlobal('useUserSession', () => ({ session: ref({ user: { id: 1 } }), loggedIn: ref(true) }))
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('useState', () => invalidation)
  vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) => new Promise<Response>((reply) => {
    reads.push({ path: new URL(String(url), 'https://example.test').pathname, body: JSON.parse(String(init?.body)), reply })
  }))
})
afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})
async function settle() {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve()
    await nextTick()
  }
  await new Promise(resolve => setTimeout(resolve, 0))
}
function response(kind: 'list' | 'detail', clicks: number): Response {
  const totals = { clicks, impressions: 420, ctr: clicks / 420, position: 3 }
  return Response.json({
    data: {
      ...(kind === 'list'
        ? { rows: [{ queryCanonical: 'Nuxt SEO', queryCanonicalKey: 'nuxt seo', ...totals }], totalCount: 1 }
        : { daily: [{ date: '2026-10-28', ...totals }] }),
      totals,
      meta: { siteUrl: 'sc-domain:example.com', syncStatus: 'synced', newestDateSynced: '2026-10-28', oldestDateSynced: '2026-10-01', dataDelay: '3 days' },
    },
    meta: { requestId: 'req_native', surface: 'analytics', version: '1.0', sourceName: 'hosted-native', sourceKind: 'sql', queryMs: 0 },
  })
}

it('keeps a daily wire request stable across clones, property order, and omitted optional fields', async () => {
  const input = ref<DailyReportInput>({ searchType: 'web', range: { start: '2026-10-01', end: '2026-10-28' }, comparisonRange: null, pin: undefined })
  const view = scope.run(() => useProGscdumpDataDetail('s_one', input))!
  await settle()
  input.value = { pin: undefined, comparisonRange: null, range: { end: '2026-10-28', start: '2026-10-01' }, searchType: 'web' }
  await settle()
  const { pin: _pin, ...same } = input.value
  input.value = same
  await settle()
  expect(reads).toHaveLength(1)
  expect(view.pending.value).toBe(true)
  expect(reads[0]).toMatchObject({ path: '/api/_gscdump/analytics/v1/sites/s_one/reports/detail', body: { state: { searchType: 'web' } } })
  reads[0]!.reply(response('detail', 42))
  await settle()
  expect(view.data.value?.daily[0]?.clicks).toBe(42)
  input.value.comparisonRange = { start: '2026-09-03', end: '2026-09-30' }
  await settle()
  expect(reads).toHaveLength(2)
  expect(reads[1]!.body).toMatchObject({ comparison: { searchType: 'web' } })
  reads[1]!.reply(response('detail', 43))
  await settle()
  expect(view.data.value?.daily[0]?.clicks).toBe(43)
})

it('reads a larger SDK row window once while retaining the loaded prefix', async () => {
  const input = ref<BreakdownInput>({ searchType: 'web', dimension: 'queryCanonical', range: { start: '2026-10-01', end: '2026-10-28' }, comparisonRange: null, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 25 })
  const view = scope.run(() => useProGscdumpData('s_one', input, { loadMore: true }))!
  await settle()
  reads[0]!.reply(response('list', 42))
  await settle()
  input.value = { ...input.value, range: { end: '2026-10-28', start: '2026-10-01' }, search: undefined }
  await settle()
  expect(reads).toHaveLength(1)
  input.value.rowLimit = 50
  await settle()
  expect(reads).toHaveLength(2)
  expect(reads[1]).toMatchObject({ path: '/api/_gscdump/analytics/v1/sites/s_one/reports', body: { state: { rowLimit: 50 } } })
  expect(view.data.value?.rows[0]?.clicks).toBe(42)
  expect(view.pending.value).toBe(true)
  input.value.range.end = '2026-10-27'
  await settle()
  expect(reads).toHaveLength(3)
  expect(view.data.value).toBeNull()
  reads[1]!.reply(response('list', 99))
  await settle()
  expect(view.data.value).toBeNull()
  reads[2]!.reply(response('list', 43))
  await settle()
  expect(view.data.value?.rows[0]?.clicks).toBe(43)
})

it('keeps request admission failures in query state and recovers through valid input', async () => {
  const input = ref<BreakdownInput>({ searchType: 'web', dimension: 'queryCanonical', range: { start: '2026-10-01', end: '2026-10-28' }, comparisonRange: null, orderBy: { column: 'clicks', dir: 'desc' }, rowLimit: 0 })
  const view = scope.run(() => useProGscdumpData('s_one', input))!
  await settle()
  expect(reads).toHaveLength(0)
  expect(view.error.value?.message).toContain('does not match the gscdump v1 contract')
  input.value.rowLimit = 25
  await settle()
  expect(reads).toHaveLength(1)
  reads[0]!.reply(response('list', 42))
  await settle()
  expect(view.error.value).toBeNull()
  expect(view.data.value?.rows[0]?.clicks).toBe(42)
})
