import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { OverviewDay, OverviewIndexing, OverviewReadRange } from '../components/overview/overview-snapshot'
import { toPartnerError } from '@gscdump/sdk/partner-errors'
import { dateFilter } from '../../shared/utils/filter-wire'
import { isOverviewReadTarget } from '../components/overview/overview-sites'
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
 * blanks the others. A realtime sync event for any Site refetches the set.
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
      body: {
        state: {
          dimensions: ['date'],
          filter: dateFilter({ start: range.start, end: range.end }),
          orderBy: { column: 'date', dir: 'asc' },
        },
      },
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

  const { data, refresh } = useAsyncData(
    () => `pro-overview:reads:${range.end}:${targets.value.map(target => target.gscdumpSiteId).join(',')}`,
    async () => {
      const entries = await Promise.all(targets.value.map(async (target) => {
        const [daily, indexing] = await Promise.all([readDaily(target.gscdumpSiteId), readIndexing(target.gscdumpSiteId)])
        return [target.siteId, { daily, indexing }] as const
      }))
      return Object.fromEntries(entries) as Record<string, OverviewSiteRead>
    },
    { server: false, watch: [invalidation] },
  )

  const reads = computed<Record<string, OverviewSiteRead>>(() => data.value ?? {})
  const loading = computed(() => targets.value.length > 0 && !data.value)

  return { reads, loading, refresh }
}
