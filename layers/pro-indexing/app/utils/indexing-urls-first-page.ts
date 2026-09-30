import type { LocationQuery } from 'vue-router'
import type { IndexingUrlsParams } from '#layers/pro-gsc/shared/gscdump-api'
import { issueDetails } from '@gscdump/sdk/indexing-issues'

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
  const issue = single(query.issue)
  const facet = single(query.facet)
  const status = single(query.status)
  return {
    issue: issue && Object.hasOwn(issueDetails, issue) ? issue : undefined,
    search: single(query.search) || undefined,
    facet: facet === 'canonical_mismatch' || facet === 'rich_results' ? facet : undefined,
    status: status === 'indexed' || status === 'not_indexed' || status === 'pending' ? status : undefined,
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
  return query.issue == null
    && query.search == null
    && query.status == null
    && query.page == null
    && query.facet == null
}
