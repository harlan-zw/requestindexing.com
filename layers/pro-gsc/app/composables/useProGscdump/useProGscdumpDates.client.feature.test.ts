import type { GoogleSearchSlice } from '../../utils/google-search-slice'
import type { CompareMode, Period } from '../useGscPeriod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, toValue, watch } from 'vue'
import { compareRange, periodToDateRange } from '../useGscPeriod'
import { useProGscdumpDates } from './useProGscdumpDates'

const engine = vi.hoisted(() => ({ detail: vi.fn(), rows: vi.fn() }))
const googleSlice = ref<GoogleSearchSlice | null>(null)
const coverageState = ref<'checking' | 'allowed' | 'refused' | 'error'>('checking')
const invalidation = ref(0)
vi.mock('../useGscComparisonCoverage', () => ({ useGscComparisonCoverage: () => ({
  state: coverageState,
  allowed: computed(() => coverageState.value === 'allowed'),
}) }))
vi.mock('../useProGscFilters', () => ({ useProGscFilters: () => ({ searchType: ref('web'), googleSlice }) }))
vi.mock('../../internal/composables/useGscInvalidation', () => ({ useGscSiteInvalidation: () => invalidation }))
vi.mock('./useProGscdump', () => ({ useProGscdump: () => ({ queryAnalyticsReportDetail: engine.detail, queryAnalyticsRows: engine.rows }) }))
Object.assign(globalThis, { computed, ref, toValue, watch, periodToDateRange, compareRange })

function report(clicks = 42) {
  return { daily: [{ date: '2026-10-23', clicks, impressions: 100, position: 3, ctr: clicks / 100 }], totals: { clicks, impressions: 100, ctr: clicks / 100, position: 3 }, meta: { source: 'r2' } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let scope: ReturnType<typeof effectScope>
beforeEach(() => {
  scope = effectScope()
  coverageState.value = 'checking'
  invalidation.value = 0
  googleSlice.value = null
  engine.rows.mockReset()
  engine.detail.mockReset().mockResolvedValue(report())
})
afterEach(() => scope.stop())
async function settle() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
function use(withPrevSeries = true) {
  const site = ref('s_one')
  const period = ref<Period>('28d')
  const compareMode = ref<CompareMode>('previous')
  const view = scope.run(() => useProGscdumpDates(site, period, { compareMode, withPrevSeries }))!
  return { site, period, compareMode, view }
}

describe('daily current and comparison reads', () => {
  it.each(['custom:2026-02-21:2026-03-01', 'custom:2026-03-01:2026-03-10'] as Period[])('refuses unproved classified history for %s despite complete recorded Web coverage', async (selectedPeriod) => {
    coverageState.value = 'allowed'
    googleSlice.value = { searchType: 'web', googleBrand: 'BRANDED', countries: [], devices: [] }
    engine.rows.mockResolvedValueOnce({ rows: [{ date: '2026-03-01', clicks: 42, impressions: 100, position: 3, ctr: 0.42 }] })
      .mockResolvedValue({ rows: selectedPeriod.includes('03-10')
        ? [{ date: '2026-02-21', clicks: 5, impressions: 20, position: 3, ctr: 0.25 }]
        : [] })
    const site = ref('s_one')
    const view = scope.run(() => useProGscdumpDates(site, ref(selectedPeriod)))!
    await settle()
    expect(view.data.value?.period.clicks).toBe(42)
    expect(view.data.value).toMatchObject({ comparisonRefused: true, hasPrevData: false, prevPeriod: null, prevDates: null })
    expect(engine.rows).toHaveBeenCalledTimes(1)
  })

  it('keeps the current read stable when coverage enables one prior read', async () => {
    const { view } = use()
    await settle()
    expect(engine.detail).toHaveBeenCalledTimes(1)
    expect(view.data.value?.period.clicks).toBe(42)
    expect(view.data.value?.prevPeriod).toBeNull()
    engine.detail.mockResolvedValueOnce(report(8))
    coverageState.value = 'allowed'
    await settle()
    expect(engine.detail).toHaveBeenCalledTimes(2)
    expect(view.data.value?.prevPeriod?.clicks).toBe(8)
    expect(view.data.value?.prevDates).toHaveLength(1)
  })

  it('performs no prior read when comparison is off, including explicit refresh', async () => {
    const { compareMode, view } = use()
    compareMode.value = 'none'
    await settle()
    expect(engine.detail).toHaveBeenCalledTimes(1)
    await view.refresh()
    expect(engine.detail).toHaveBeenCalledTimes(2)
    expect(view.data.value?.prevPeriod).toBeNull()
  })

  it('uses one prior report for totals when a drill-down omits the overlay', async () => {
    coverageState.value = 'allowed'
    engine.detail.mockResolvedValueOnce(report(42)).mockResolvedValueOnce(report(8))
    const { view } = use(false)
    await settle()
    expect(engine.detail).toHaveBeenCalledTimes(2)
    expect(view.data.value?.prevPeriod?.clicks).toBe(8)
    expect(view.data.value?.prevDates).toBeNull()
  })

  it('keeps current values while a prior read waits or fails', async () => {
    const previous = deferred<ReturnType<typeof report>>()
    engine.detail.mockResolvedValueOnce(report(42)).mockReturnValueOnce(previous.promise)
    const { view } = use()
    await settle()
    coverageState.value = 'allowed'
    await settle()
    expect(view.pending.value).toBe(false)
    expect(view.data.value?.period.clicks).toBe(42)
    previous.reject(new Error('Prior read unavailable'))
    await settle()
    expect(view.error.value).toBeNull()
    expect(view.data.value?.period.clicks).toBe(42)
    expect(view.data.value?.prevPeriod).toBeNull()
    expect(view.data.value).toMatchObject({ hasPrevData: false, comparisonReadFailed: true })
  })

  it('retains the same-window refresh and clears values after a Site or period change', async () => {
    const { site, period, view } = use()
    await settle()
    const held = deferred<ReturnType<typeof report>>()
    engine.detail.mockReturnValue(held.promise)
    invalidation.value++
    await settle()
    expect(view.data.value?.period.clicks).toBe(42)
    period.value = '7d'
    await settle()
    expect(view.data.value).toBeNull()
    held.resolve(report(8))
    await settle()
    expect(view.data.value?.period.clicks).toBe(8)
    engine.detail.mockReturnValue(deferred<ReturnType<typeof report>>().promise)
    site.value = 's_two'
    await settle()
    expect(view.data.value).toBeNull()
  })

  it('allows a proved empty prior period and reports failed comparison coverage', async () => {
    coverageState.value = 'allowed'
    engine.detail.mockResolvedValueOnce(report(42)).mockResolvedValueOnce({ daily: [], totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, meta: { source: 'r2' } })
    const { view } = use()
    await settle()
    expect(view.data.value?.hasPrevData).toBe(true)
    expect(view.data.value?.prevPeriod?.clicks).toBe(0)
    coverageState.value = 'error'
    await settle()
    expect(view.data.value?.period.clicks).toBe(42)
    expect(view.data.value?.prevPeriod).toBeNull()
    expect(view.data.value?.comparisonReadFailed).toBe(true)
  })
})
