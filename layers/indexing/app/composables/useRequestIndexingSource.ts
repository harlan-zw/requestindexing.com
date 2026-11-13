// Request Indexing's IndexingSource: the one adapter the `@nuxtseo/pro-indexing`
// sections read. Every read goes through this app's `useProGscdump` proxy or
// its own `/api/pro/sites/*` routes, with the keys its pages already use, so
// caching, SSR seeding and deduping stay as they were.
//
// `IndexingSite.dataId` is the gscdump Site id. `IndexingSite.id` and `ref`
// are the route id (`s_` public id) this app's own routes take.

import type { IndexCohortsResponse } from '@gscdump/sdk/indexing'
import type { IndexingChangesRollup } from '@nuxtseo/pro-indexing/shared/changes'
import type { IndexingRead, IndexingSite, IndexingSitemapProblems, IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import type { MaybeRefOrGetter } from 'vue'
import type { SiteSitemapEvidence, SiteTransitionsRead } from '#layers/indexing/app/utils/indexing-source'
import { buildIndexCohortsFromIndexingUrls } from '@gscdump/sdk/indexing'
import { withQuery } from 'ufo'
import { computed, toValue } from 'vue'
import { useAsyncData } from '#imports'
import {
  changesRollupFromTransitions,
  INDEXING_CHANGES_PAGE_LIMIT,
  INDEXING_CHANGES_WINDOW_DAYS,
  sitemapProblemsFrom,
  toIndexingInspectResult,
  utcDay,
  windowStart,
} from '#layers/indexing/app/utils/indexing-source'
import { sitemapLivenessSchema } from '#layers/indexing/shared/contracts/sitemap-liveness'
import { diagnoseIndexing } from '#layers/indexing/shared/indexing-diagnosis'
import {
  useProGscdump,
  useProGscdumpCanonicalMismatches,
  useProGscdumpIndexingDiagnostics,
  useProGscdumpIndexingUrls,
  useProGscdumpInspectUrls,
} from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProFetch } from '#layers/pro-saas/app/composables/useProFetch'

type SiteInput = MaybeRefOrGetter<IndexingSite | null | undefined>

/** The rows the Overview reads, so the cohort build reuses its snapshot. */
export const INDEXING_OVERVIEW_URLS_LIMIT = 500

export interface RequestIndexingSourceOptions {
  /**
   * The Sites of the Portfolio in view. With it, the source has the
   * `sitemapProblems` and `changesRollup` capabilities. The fleet pages pass
   * their Site list; a Site page has no Portfolio.
   */
  readonly portfolio?: () => readonly IndexingSite[]
  /**
   * False for a view-only Team role. `inspect.create` is a write the proxy
   * refuses, so without it the source has no `inspect` capability.
   */
  readonly canInspect?: boolean
}

function dataId(site: SiteInput): string {
  return toValue(site)?.dataId ?? ''
}

function linked(sites: readonly IndexingSite[]): IndexingSite[] {
  return sites.filter(site => site.dataId !== null)
}

function portfolioKey(prefix: string, sites: readonly IndexingSite[]): string {
  return `${prefix}:${linked(sites).map(site => `${site.id}=${site.dataId}`).join(',')}`
}

/**
 * Index cohorts for one Site. The Overview already reads the first 500 URLs
 * and the diagnostics. When that snapshot is the whole inspected set, the
 * cohorts build here from it. Otherwise this app's cohorts route pages
 * through the set on the server. Starting that scan beside the Overview read
 * would queue two cold scans of the same rows.
 */
function useCohorts(site: SiteInput): IndexingRead<IndexCohortsResponse> {
  const proFetch = useProFetch()
  const urls = useProGscdumpIndexingUrls(computed(() => dataId(site)), { limit: INDEXING_OVERVIEW_URLS_LIMIT }, { immediate: !!dataId(site) })
  const diagnostics = useProGscdumpIndexingDiagnostics(computed(() => dataId(site)), { immediate: !!dataId(site) })
  return useAsyncData<IndexCohortsResponse | null>(
    computed(() => `indexing-cohorts:${toValue(site)?.id ?? ''}`),
    async () => {
      const current = toValue(site)
      const snapshot = urls.status.value === 'success' ? urls.data.value : null
      const reported = diagnostics.status.value === 'success' ? diagnostics.data.value : null
      if (!current?.dataId || !snapshot || !reported)
        return null
      if (snapshot.pagination.hasMore || snapshot.urls.length !== snapshot.pagination.total)
        return proFetch<IndexCohortsResponse>(`/api/pro/sites/${current.id}/indexing/cohorts`)
      return buildIndexCohortsFromIndexingUrls({
        urls: snapshot.urls,
        siteUrl: snapshot.meta?.siteUrl,
        reportedNotIndexed: reported.issues.find(issue => issue.type === 'not_indexed')?.count ?? 0,
      }, new Date().toISOString())
    },
    { server: false, lazy: true, watch: [urls.data, urls.status, diagnostics.data, diagnostics.status] },
  )
}

/**
 * Sitemap problems across the Portfolio, from each Site's Sitemaps report and
 * the live probe of its first Sitemap. The probe route caches each answer for
 * 30 minutes, and the Site Overview probes the same Sitemap.
 */
function useSitemapProblems(portfolio: () => readonly IndexingSite[]): IndexingRead<IndexingSitemapProblems> {
  const gscdump = useProGscdump()
  const proFetch = useProFetch()
  return useAsyncData<IndexingSitemapProblems>(
    computed(() => portfolioKey('indexing-sitemap-problems', portfolio())),
    // A Site whose evidence read fails has no evidence, so it counts in
    // neither list. The tile reports problems it observed, never a guess.
    async () => sitemapProblemsFrom(await Promise.all(linked(portfolio()).map(async (site): Promise<SiteSitemapEvidence> => {
      const sitemaps = await gscdump.getSiteSitemaps({ params: { siteId: site.dataId! } }, true).catch(() => null)
      const primary = sitemaps?.sitemaps[0]?.path
      const base = `/api/pro/sites/${site.id}/sitemap-liveness`
      const live = await proFetch<unknown>(primary ? withQuery(base, { sitemap: primary }) : base).catch(() => null)
      const parsed = sitemapLivenessSchema.safeParse(live)
      return { siteId: site.id, liveness: parsed.success ? parsed.data : null, sitemaps }
    }))),
    { server: false, lazy: true, default: () => ({ unreachable: [], errors: [] }) },
  )
}

/**
 * Portfolio Changes from one transitions read per Site: the `indexStatus`
 * changes of the last 28 days, at most 500 per Site.
 */
function useChangesRollup(portfolio: () => readonly IndexingSite[]): IndexingRead<IndexingChangesRollup> {
  const gscdump = useProGscdump()
  return useAsyncData<IndexingChangesRollup>(
    computed(() => portfolioKey('indexing-changes', portfolio())),
    async () => {
      const through = utcDay(new Date())
      const startDate = windowStart(through, INDEXING_CHANGES_WINDOW_DAYS)
      const reads = await Promise.all(linked(portfolio()).map(async (site): Promise<SiteTransitionsRead> => {
        const response = await gscdump.listSiteIndexingTransitions({
          params: { siteId: site.dataId! },
          query: { field: 'indexStatus', startDate, endDate: through, limit: INDEXING_CHANGES_PAGE_LIMIT },
        }, true)
        return { siteId: site.id, transitions: response.transitions }
      }))
      return changesRollupFromTransitions(reads, through)
    },
    { server: false, lazy: true },
  )
}

export function useRequestIndexingSource(options: RequestIndexingSourceOptions = {}): IndexingSource {
  const { portfolio, canInspect = true } = options
  return {
    diagnostics: site => useProGscdumpIndexingDiagnostics(computed(() => dataId(site)), { immediate: !!dataId(site) }),
    // The URLs page seeds the clean first page into the SSR payload under this
    // query's key (`useIndexingUrlsFirstPageSeed`). Hydration reuses it.
    urls: (site, params) => useProGscdumpIndexingUrls(computed(() => dataId(site)), params, { immediate: !!dataId(site), seedFromSsrPayload: true }),
    diagnose: input => diagnoseIndexing(input),
    ...(canInspect
      ? {
          inspect: () => {
            const inspectUrls = useProGscdumpInspectUrls()
            return (site, urls) => inspectUrls(site.dataId ?? '', [...urls]).then(toIndexingInspectResult)
          },
        }
      : {}),
    // The facet query switches the read on. Leaving the facet sends an empty
    // Site id, which reads nothing.
    canonicalMismatches: (site, enabled) => useProGscdumpCanonicalMismatches(
      computed(() => toValue(enabled) ? dataId(site) : ''),
      { immediate: !!dataId(site) && toValue(enabled) },
    ),
    cohorts: site => useCohorts(site),
    ...(portfolio
      ? {
          sitemapProblems: () => useSitemapProblems(portfolio),
          changesRollup: () => useChangesRollup(portfolio),
        }
      : {}),
    watchedUrls: true,
  }
}
