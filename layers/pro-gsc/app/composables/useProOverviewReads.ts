import type { MaybeRefOrGetter } from 'vue'
import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { OverviewDay, OverviewIndexing, OverviewReadRange } from '../components/overview/overview-snapshot'
import { toPartnerError } from '@gscdump/sdk/partner-errors'
import { computed, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import { dailyReportRequest } from '../../shared/analytics-requests'
import { invalidatedTargets, isOverviewReadTarget } from '../components/overview/overview-sites'
import { useGscInvalidationMap } from '../internal/composables/useGscInvalidation'
import { useProGscdump } from './useProGscdump'

/** One read, as a value: a failure is data the page shows, never a throw. */
export type OverviewResult<T>
  = | { _tag: 'Pending' }
    | { _tag: 'Ok', value: T }
    | { _tag: 'Err', error: unknown }
    | { _tag: 'Stale', value: T, error: unknown }

/** What the dashboard home knows about one Site's Search Console data. */
export interface OverviewSiteRead {
  daily: OverviewResult<OverviewDay[]>
  /** `Ok(null)` when gscdump holds no indexing summary for the Site yet. */
  indexing: OverviewResult<OverviewIndexing | null>
}

/**
 * The dashboard home's per-Site reads: one daily Search Console read and one
 * indexing summary per synced Site, published independently.
 *
 * A Site that has never synced gets no request, so it is absent from the map
 * rather than pending. One Site's failure lands on that Site's entry and never
 * blanks the others. A realtime sync event refetches only the Site it names.
 */
export function useProOverviewReads(sites: MaybeRefOrGetter<readonly SiteFleetRow[]>, range: OverviewReadRange) {
  const gscdump = useProGscdump()
  const invalidation = useGscInvalidationMap()

  const targets = computed(() => toValue(sites)
    .filter(isOverviewReadTarget)
    .map(site => ({ siteId: site.siteId, gscdumpSiteId: site.gscdumpSiteId })))

  function readDaily(gscdumpSiteId: string): Promise<OverviewResult<OverviewDay[]>> {
    return gscdump.queryAnalyticsReportDetail({
      params: { siteId: gscdumpSiteId },
      // The home has no search type picker, so the band reads Web search.
      body: dailyReportRequest({ searchType: 'web', range: { start: range.start, end: range.end }, comparisonRange: null }),
    }, true)
      .then(result => ({ _tag: 'Ok' as const, value: result.daily }))
      .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  }

  function readIndexing(gscdumpSiteId: string): Promise<OverviewResult<OverviewIndexing | null>> {
    return gscdump.getSiteIndexing({ params: { siteId: gscdumpSiteId }, query: { days: 28 } }, true)
      .then(result => ({
        _tag: 'Ok' as const,
        value: { indexedPercent: result.summary.indexedPercent, notIndexed: result.summary.notIndexed },
      }))
      // A 404 means gscdump holds no indexing summary for the Site. That is
      // "no summary", not a failure, so the band leaves the Site out quietly.
      .catch((error: unknown) => toPartnerError(error).kind === 'not-found'
        ? { _tag: 'Ok' as const, value: null }
        : { _tag: 'Err' as const, error })
  }

  const loaded = ref<Record<string, OverviewSiteRead & { gscdumpSiteId: string, version: number }>>({})
  let version = 0
  let active = true
  onScopeDispose(() => {
    active = false
  })

  async function load(list: readonly { siteId: string, gscdumpSiteId: string }[]): Promise<void> {
    if (!list.length)
      return
    await Promise.all(list.map(async (target) => {
      const prior = loaded.value[target.siteId]
      const retained = prior?.gscdumpSiteId === target.gscdumpSiteId ? prior : null
      const requestVersion = ++version
      loaded.value = { ...loaded.value, [target.siteId]: {
        gscdumpSiteId: target.gscdumpSiteId,
        version: requestVersion,
        daily: retained?.daily ?? { _tag: 'Pending' },
        indexing: retained?.indexing ?? { _tag: 'Pending' },
      } }
      function publish<K extends keyof OverviewSiteRead>(source: K, value: OverviewSiteRead[K]) {
        const current = loaded.value[target.siteId]
        if (!active || current?.version !== requestVersion
          || !targets.value.some(site => site.siteId === target.siteId && site.gscdumpSiteId === target.gscdumpSiteId)) {
          return
        }
        const previous = current[source]
        const next = value._tag === 'Err' && (previous._tag === 'Ok' || previous._tag === 'Stale')
          ? { _tag: 'Stale' as const, value: previous.value, error: value.error }
          : value
        loaded.value = { ...loaded.value, [target.siteId]: { ...current, [source]: next } }
      }
      await Promise.all([
        readDaily(target.gscdumpSiteId).then(result => publish('daily', result)),
        readIndexing(target.gscdumpSiteId).then(result => publish('indexing', result)),
      ])
    }))
  }

  /** Refetch the given Sites by app id, or every Site when none are named. */
  function refresh(siteIds?: readonly string[]): Promise<void> {
    return load(siteIds ? targets.value.filter(target => siteIds.includes(target.siteId)) : targets.value)
  }

  // Client only, as before: the first load, then each Site that becomes
  // readable (a first sync finishing) loads once.
  onMounted(() => {
    void load(targets.value)
    watch(() => targets.value.map(target => `${target.siteId}:${target.gscdumpSiteId}`).join(','), () => {
      loaded.value = Object.fromEntries(Object.entries(loaded.value)
        .filter(([siteId, read]) => targets.value.some(target => target.siteId === siteId && target.gscdumpSiteId === read.gscdumpSiteId)))
      void load(targets.value.filter(target => !(target.siteId in loaded.value)))
    })
    // A realtime event names one Site, so only that Site refetches.
    watch(invalidation, (next, prev) => {
      void load(invalidatedTargets(targets.value, next, prev))
    })
  })

  const reads = computed<Record<string, OverviewSiteRead>>(() => Object.fromEntries(
    targets.value.flatMap((target) => {
      const read = loaded.value[target.siteId]
      return read?.gscdumpSiteId === target.gscdumpSiteId ? [[target.siteId, read]] : []
    }),
  ))
  // A fleet number must not publish only the fastest Sites. Retained values
  // stay usable during refresh, while each source settles independently.
  const pendingSources = computed(() => ({
    daily: targets.value.some(target => !reads.value[target.siteId] || reads.value[target.siteId]!.daily._tag === 'Pending'),
    indexing: targets.value.some(target => !reads.value[target.siteId] || reads.value[target.siteId]!.indexing._tag === 'Pending'),
  }))
  const loading = computed(() => pendingSources.value.daily || pendingSources.value.indexing)

  return { reads, loading, pendingSources, refresh }
}
