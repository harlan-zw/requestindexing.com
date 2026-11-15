import type { LocationQuery } from 'vue-router'
import type { IndexingUrlsParams } from '#layers/pro-gsc/shared/gscdump-api'

/**
 * The URLs table's clean first page, which the server seeds.
 *
 * `IndexingUrlsTable` reads its filters from the route query itself
 * (`parseIndexingUrlsQuery` in `@nuxtseo/pro-indexing`). The page seeds the
 * first page only for a route with none of them.
 *
 * Ported from nuxtseo.com `layers/pro/gsc/app/utils/indexing-urls-first-page.ts`.
 */

/** Page size the URLs page and `IndexingUrlsTable` mount with. */
export const INDEXING_URLS_PAGE_SIZE = 25

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
