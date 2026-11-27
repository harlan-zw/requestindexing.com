import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { OverviewDay, OverviewReadRange } from '../components/overview/overview-snapshot'
import type { UseProOverviewReadsOptions } from './useProOverviewReads'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { useProOverviewReads } from './useProOverviewReads'

const transport = vi.hoisted(() => ({
  queryAnalyticsReportDetail: vi.fn(),
  getSiteIndexing: vi.fn(),
}))

const state = {
  invalidation: ref<Record<string, number>>({}),
}

vi.mock('./useProGscdump', () => ({
  useProGscdump: () => transport,
}))

vi.mock('../internal/composables/useGscInvalidation', () => ({
  useGscInvalidationMap: () => state.invalidation,
}))

const RANGE: OverviewReadRange = {
  window: { start: '2026-10-01', end: '2026-10-28', prevStart: '2026-09-03', prevEnd: '2026-09-30' },
  start: '2026-07-31',
  end: '2026-10-28',
}

function makeSite(index: number, overrides: Partial<SiteFleetRow> = {}): SiteFleetRow {
  const id = `site_${index}`
  return {
    siteId: id,
    domain: `site-${index}.example.com`,
    property: `sc-domain:site-${index}.example.com`,
    sitemaps: [],
    gscdumpSiteId: `gsd_${index}`,
    syncStatus: 'synced',
    syncProgress: 100,
    hold: null,
    lastSynced: 1_700_000_000_000,
    permissionLost: false,
    syncedRange: { oldest: '2026-07-01', newest: '2026-10-28' },
    ...overrides,
  }
}

function makeDaily(clicks: number): { daily: OverviewDay[] } {
  return {
    daily: [{ date: '2026-10-28', clicks, impressions: clicks * 10, position: 4.2 }],
  }
}

function makeIndexing(indexedPercent: number, notIndexed = 5) {
  return {
    summary: { indexedPercent, notIndexed },
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flush(rounds = 16) {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

const unmounts: Array<() => void> = []

function mountReads(sites: SiteFleetRow[], options?: UseProOverviewReadsOptions) {
  const siteList = ref<SiteFleetRow[]>(sites)
  let api!: ReturnType<typeof useProOverviewReads>
  const app = createApp(defineComponent({
    setup() {
      api = useProOverviewReads(siteList, RANGE, options)
      return () => h('div')
    },
  }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  app.mount(host)
  const unmount = () => {
    app.unmount()
    host.remove()
  }
  unmounts.push(unmount)
  return { api, siteList, unmount }
}

beforeEach(() => {
  transport.queryAnalyticsReportDetail.mockReset()
  transport.getSiteIndexing.mockReset()
  state.invalidation.value = {}
})

afterEach(() => {
  for (const unmount of unmounts.splice(0))
    unmount()
})

describe('useProOverviewReads', () => {
  it('caps peak concurrent targets and HTTP calls to the configured concurrency', async () => {
    const sites = Array.from({ length: 12 }, (_, i) => makeSite(i))
    const inFlightTargets = new Map<string, number>()
    let activeHttp = 0
    let peakTargets = 0
    let peakHttp = 0

    const pendingDaily = new Map<string, Deferred<{ daily: OverviewDay[] }>>()
    const pendingIndexing = new Map<string, Deferred<{ summary: { indexedPercent: number, notIndexed: number } }>>()

    function enter(gscdumpSiteId: string) {
      inFlightTargets.set(gscdumpSiteId, (inFlightTargets.get(gscdumpSiteId) ?? 0) + 1)
      activeHttp++
      peakTargets = Math.max(peakTargets, inFlightTargets.size)
      peakHttp = Math.max(peakHttp, activeHttp)
    }
    function leave(gscdumpSiteId: string) {
      activeHttp--
      const remaining = (inFlightTargets.get(gscdumpSiteId) ?? 1) - 1
      if (remaining <= 0)
        inFlightTargets.delete(gscdumpSiteId)
      else
        inFlightTargets.set(gscdumpSiteId, remaining)
    }

    transport.queryAnalyticsReportDetail.mockImplementation(({ params }: { params: { siteId: string } }) => {
      enter(params.siteId)
      const gate = deferred<{ daily: OverviewDay[] }>()
      pendingDaily.set(params.siteId, gate)
      return gate.promise.finally(() => leave(params.siteId))
    })
    transport.getSiteIndexing.mockImplementation(({ params }: { params: { siteId: string } }) => {
      enter(params.siteId)
      const gate = deferred<{ summary: { indexedPercent: number, notIndexed: number } }>()
      pendingIndexing.set(params.siteId, gate)
      return gate.promise.finally(() => leave(params.siteId))
    })

    const { api } = mountReads(sites, { concurrency: 3 })
    await flush()

    // First wave starts exactly 3 targets (6 HTTP calls) while all 12 entries are pending.
    expect(pendingDaily.size).toBe(3)
    expect(pendingIndexing.size).toBe(3)
    expect(Object.keys(api.reads.value)).toHaveLength(12)
    expect(api.loading.value).toBe(true)

    // Drain every wave until all 12 targets settle.
    while (pendingDaily.size > 0 || pendingIndexing.size > 0) {
      for (const [id, gate] of [...pendingDaily.entries()]) {
        pendingDaily.delete(id)
        gate.resolve(makeDaily(Number(id.replace('gsd_', '')) + 1))
      }
      for (const [id, gate] of [...pendingIndexing.entries()]) {
        pendingIndexing.delete(id)
        gate.resolve(makeIndexing(90, 2))
      }
      await flush()
    }

    expect(peakTargets).toBe(3)
    expect(peakHttp).toBe(6)
    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledTimes(12)
    expect(transport.getSiteIndexing).toHaveBeenCalledTimes(12)
    expect(api.loading.value).toBe(false)
    for (let i = 0; i < 12; i++) {
      expect(api.reads.value[`site_${i}`]?.daily).toEqual({ _tag: 'Ok', value: makeDaily(i + 1).daily })
      expect(api.reads.value[`site_${i}`]?.indexing).toEqual({ _tag: 'Ok', value: { indexedPercent: 90, notIndexed: 2 } })
    }
  })

  it('publishes early targets incrementally before queued targets start', async () => {
    const sites = Array.from({ length: 5 }, (_, i) => makeSite(i))
    const dailyGates = new Map<string, Deferred<{ daily: OverviewDay[] }>>()
    const indexingGates = new Map<string, Deferred<{ summary: { indexedPercent: number, notIndexed: number } }>>()

    transport.queryAnalyticsReportDetail.mockImplementation(({ params }: { params: { siteId: string } }) => {
      const gate = deferred<{ daily: OverviewDay[] }>()
      dailyGates.set(params.siteId, gate)
      return gate.promise
    })
    transport.getSiteIndexing.mockImplementation(({ params }: { params: { siteId: string } }) => {
      const gate = deferred<{ summary: { indexedPercent: number, notIndexed: number } }>()
      indexingGates.set(params.siteId, gate)
      return gate.promise
    })

    const { api } = mountReads(sites, { concurrency: 2 })
    await flush()

    // Only sites 0 and 1 have started; sites 2..4 are still queued.
    expect([...dailyGates.keys()]).toEqual(['gsd_0', 'gsd_1'])

    // Resolving site_0's daily read publishes it immediately before site_0's indexing read finishes
    // and before site_2 starts.
    dailyGates.get('gsd_0')!.resolve(makeDaily(42))
    await flush()

    expect(api.reads.value.site_0?.daily).toEqual({ _tag: 'Ok', value: makeDaily(42).daily })
    expect(api.reads.value.site_0?.indexing).toEqual({ _tag: 'Pending' })
    expect(dailyGates.has('gsd_2')).toBe(false)

    // Resolving site_0's indexing finishes target 0 and launches target 2, while target 3 and 4 remain queued.
    indexingGates.get('gsd_0')!.resolve(makeIndexing(88, 3))
    await flush()

    expect(api.reads.value.site_0?.indexing).toEqual({ _tag: 'Ok', value: { indexedPercent: 88, notIndexed: 3 } })
    expect(dailyGates.has('gsd_2')).toBe(true)
    expect(dailyGates.has('gsd_3')).toBe(false)
    expect(api.reads.value.site_3?.daily).toEqual({ _tag: 'Pending' })
    expect(api.loading.value).toBe(true)
  })

  it('stops starting queued targets when the scope is disposed mid-queue', async () => {
    const sites = Array.from({ length: 8 }, (_, i) => makeSite(i))
    const dailyGates = new Map<string, Deferred<{ daily: OverviewDay[] }>>()
    const indexingGates = new Map<string, Deferred<{ summary: { indexedPercent: number, notIndexed: number } }>>()

    transport.queryAnalyticsReportDetail.mockImplementation(({ params }: { params: { siteId: string } }) => {
      const gate = deferred<{ daily: OverviewDay[] }>()
      dailyGates.set(params.siteId, gate)
      return gate.promise
    })
    transport.getSiteIndexing.mockImplementation(({ params }: { params: { siteId: string } }) => {
      const gate = deferred<{ summary: { indexedPercent: number, notIndexed: number } }>()
      indexingGates.set(params.siteId, gate)
      return gate.promise
    })

    const { api, unmount } = mountReads(sites, { concurrency: 2 })
    await flush()

    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledTimes(2)
    expect(transport.getSiteIndexing).toHaveBeenCalledTimes(2)

    // Dispose the scope while sites 2..7 are still waiting in the queue.
    unmount()

    // Settling the two in-flight targets must neither publish nor start targets 2..7.
    for (const gate of dailyGates.values())
      gate.resolve(makeDaily(10))
    for (const gate of indexingGates.values())
      gate.resolve(makeIndexing(75, 1))
    await flush()

    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledTimes(2)
    expect(transport.getSiteIndexing).toHaveBeenCalledTimes(2)
    expect(api.reads.value.site_0?.daily).toEqual({ _tag: 'Pending' })
    expect(api.reads.value.site_2?.daily).toEqual({ _tag: 'Pending' })
  })

  it('clamps concurrency values below 1 to 1', async () => {
    const sites = Array.from({ length: 4 }, (_, i) => makeSite(i))
    let activeTargets = 0
    let peakTargets = 0

    transport.queryAnalyticsReportDetail.mockImplementation(async () => {
      activeTargets++
      peakTargets = Math.max(peakTargets, activeTargets)
      await Promise.resolve()
      activeTargets--
      return makeDaily(5)
    })
    transport.getSiteIndexing.mockResolvedValue(makeIndexing(100, 0))

    const { api } = mountReads(sites, { concurrency: 0 })
    await flush()

    expect(peakTargets).toBe(1)
    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledTimes(4)
    expect(api.loading.value).toBe(false)
  })

  it('preserves Stale values on refresh failure and scopes refresh(siteIds) to named Sites', async () => {
    const sites = [makeSite(0), makeSite(1), makeSite(2)]
    transport.queryAnalyticsReportDetail.mockImplementation(async ({ params }: { params: { siteId: string } }) => {
      const idx = Number(params.siteId.replace('gsd_', ''))
      return makeDaily((idx + 1) * 10)
    })
    transport.getSiteIndexing.mockImplementation(async ({ params }: { params: { siteId: string } }) => {
      const idx = Number(params.siteId.replace('gsd_', ''))
      return makeIndexing(80 + idx, idx)
    })

    const { api } = mountReads(sites, { concurrency: 2 })
    await flush()

    expect(api.reads.value.site_0?.daily).toEqual({ _tag: 'Ok', value: makeDaily(10).daily })
    expect(api.reads.value.site_1?.daily).toEqual({ _tag: 'Ok', value: makeDaily(20).daily })
    expect(api.loading.value).toBe(false)

    // Scoped refresh of site_1: daily fails (transitions to Stale keeping prior value),
    // indexing succeeds with updated value, and site_0 / site_2 are not refetched.
    transport.queryAnalyticsReportDetail.mockClear()
    transport.getSiteIndexing.mockClear()
    const failure = new Error('upstream timeout')
    transport.queryAnalyticsReportDetail.mockRejectedValueOnce(failure)
    transport.getSiteIndexing.mockResolvedValueOnce(makeIndexing(95, 1))

    await api.refresh(['site_1'])

    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledTimes(1)
    expect(transport.queryAnalyticsReportDetail).toHaveBeenCalledWith(expect.objectContaining({ params: { siteId: 'gsd_1' } }), true)
    expect(transport.getSiteIndexing).toHaveBeenCalledTimes(1)
    expect(api.reads.value.site_1?.daily).toEqual({
      _tag: 'Stale',
      value: makeDaily(20).daily,
      error: failure,
    })
    expect(api.reads.value.site_1?.indexing).toEqual({
      _tag: 'Ok',
      value: { indexedPercent: 95, notIndexed: 1 },
    })
    expect(api.reads.value.site_0?.daily).toEqual({ _tag: 'Ok', value: makeDaily(10).daily })
    expect(api.reads.value.site_2?.daily).toEqual({ _tag: 'Ok', value: makeDaily(30).daily })
  })
})
