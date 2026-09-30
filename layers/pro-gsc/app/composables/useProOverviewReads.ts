import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { OverviewDay, OverviewIndexing, OverviewReadRange } from '../components/overview/overview-snapshot'
import { toPartnerError } from '@gscdump/sdk/partner-errors'
import { dailyReportRequest } from '../../shared/analytics-requests'
import { invalidatedTargets, isOverviewReadTarget } from '../components/overview/overview-sites'
import { useGscInvalidationMap } from '../internal/composables/useGscInvalidation'
import { useProGscdump } from './useProGscdump'

/** One read, as a value: a failure is data the page shows, never a throw. */
export type OverviewResult<T> = { _tag: 'Ok', value: T } | { _tag: 'Err', error: unknown }

/** What the dashboard home knows about one Site's Search Console data. */
export interface OverviewSiteRead {
  daily: OverviewResult<OverviewDay[]>
  /** `Ok(null)` when gscdump holds no indexing summary for the Site yet. */
  indexing: OverviewResult<OverviewIndexing | null>
}

/**
 * The dashboard home's per-Site reads: one daily Search Console read and one
 * indexing summary per synced Site, fetched together.
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

  const loaded = ref<Record<string, OverviewSiteRead>>({})
  const settled = ref(false)

  async function load(list: readonly { siteId: string, gscdumpSiteId: string }[]): Promise<void> {
    if (!list.length)
      return
    const entries = await Promise.all(list.map(async (target) => {
      const [daily, indexing] = await Promise.all([readDaily(target.gscdumpSiteId), readIndexing(target.gscdumpSiteId)])
      return [target.siteId, { daily, indexing }] as const
    }))
    loaded.value = { ...loaded.value, ...Object.fromEntries(entries) }
  }

  /** Refetch the given Sites by app id, or every Site when none are named. */
  function refresh(siteIds?: readonly string[]): Promise<void> {
    return load(siteIds ? targets.value.filter(target => siteIds.includes(target.siteId)) : targets.value)
  }

  // Client only, as before: the first load, then each Site that becomes
  // readable (a first sync finishing) loads once.
  onMounted(() => {
    void load(targets.value).finally(() => {
      settled.value = true
    })
    watch(() => targets.value.map(target => target.siteId).join(','), () => {
      void load(targets.value.filter(target => !(target.siteId in loaded.value)))
    })
    // A realtime event names one Site, so only that Site refetches.
    watch(invalidation, (next, prev) => {
      void load(invalidatedTargets(targets.value, next, prev))
    })
  })

  const reads = computed<Record<string, OverviewSiteRead>>(() => Object.fromEntries(
    targets.value.flatMap(target => target.siteId in loaded.value ? [[target.siteId, loaded.value[target.siteId]!]] : []),
  ))
  const loading = computed(() => targets.value.length > 0 && !settled.value)

  return { reads, loading, refresh }
}
