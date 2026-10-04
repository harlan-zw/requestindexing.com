import type { LocationQuery } from 'vue-router'
import type { IndexingUrlsParams } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexCohortFilter } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { issueDetails } from '@gscdump/sdk/indexing-issues'
import { parseIndexCohortFilter } from '#layers/pro-indexing/shared/contracts/index-cohorts'

/**
 * The URLs table's route query, parsed once.
 *
 * Every view of the table is a link: `issue`, `status`, `facet`, `search` and
 * `page` all live in the query. The page reads them through here, and the
 * first-page prefetch uses the same parse to decide whether it applies.
 *
 * Ported from nuxtseo.com `layers/pro/gsc/app/utils/indexing-urls-first-page.ts`
 * and the query reads in its `indexing/urls.vue`.
 */

/** Page size the URLs page and `TableIndexingUrls` mount with. */
export const INDEXING_URLS_PAGE_SIZE = 25

export type IndexingUrlsStatus = NonNullable<IndexingUrlsParams['status']>
export type IndexingUrlsFacet = 'canonical_mismatch' | 'rich_results'

export interface IndexingUrlsRouteState {
  cohort: IndexCohortFilter | undefined
  /** An issue type gscdump knows. An unknown value is dropped, never forwarded. */
  issue: string | undefined
  search: string | undefined
  facet: IndexingUrlsFacet | undefined
  status: IndexingUrlsStatus | undefined
  /** 1-based. Anything that is not a positive safe integer reads as page 1. */
  page: number
}

function single(value: LocationQuery[string] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function parseIndexingUrlsPage(value: LocationQuery[string] | undefined): number {
  const raw = single(value)
  if (!raw || !/^[1-9]\d*$/.test(raw))
    return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) ? page : 1
}

export function parseIndexingUrlsRouteQuery(query: LocationQuery): IndexingUrlsRouteState {
  const rawIssue = single(query.issue)
  const rawFacet = single(query.facet)
  const rawStatus = single(query.status)
  const issue = rawIssue && Object.hasOwn(issueDetails, rawIssue) ? rawIssue : undefined
  const facet = rawFacet === 'canonical_mismatch' || rawFacet === 'rich_results' ? rawFacet : undefined
  const status = rawStatus === 'indexed' || rawStatus === 'not_indexed' || rawStatus === 'pending' ? rawStatus : undefined
  const cohort = issue || facet || (status && status !== 'not_indexed') ? undefined : parseIndexCohortFilter(query.cohort)
  return {
    cohort,
    issue,
    search: single(query.search) || undefined,
    facet,
    status: cohort ? 'not_indexed' : status,
    page: parseIndexingUrlsPage(query.page),
  }
}

/**
 * First-page params. `JSON.stringify` drops the table's undefined `status`,
 * `issue` and `search` members, so this subset builds the exact key the table
 * computes for a clean first page.
 */
export function firstPageIndexingUrlsParams(pageSize: number): IndexingUrlsParams {
  return { limit: pageSize, offset: 0 }
}

/** True when the route carries none of the table's URL-driven filters. */
export function isFirstPageIndexingUrlsRouteQuery(query: LocationQuery): boolean {
  return query.cohort == null
    && query.issue == null
    && query.search == null
    && query.status == null
    && query.page == null
    && query.facet == null
}
