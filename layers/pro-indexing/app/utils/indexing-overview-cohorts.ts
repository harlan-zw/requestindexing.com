import type { GscdumpIndexingDiagnosticsResponse, GscdumpIndexingUrlsResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexCohortsResponse } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import type { IndexCohortSource } from '#layers/pro-indexing/shared/index-cohort-source'
import { buildIndexCohortsFromIndexingUrls } from '#layers/pro-indexing/shared/index-cohort-source'

interface OverviewUrls {
  urls: IndexCohortSource['urls']
  pagination: Pick<GscdumpIndexingUrlsResponse['pagination'], 'total' | 'hasMore'>
  meta?: { siteUrl?: string | null } | null
}
interface OverviewDiagnostics {
  issues: ReadonlyArray<Pick<GscdumpIndexingDiagnosticsResponse['issues'][number], 'type' | 'count'>>
}

export async function loadIndexingOverviewCohorts(
  urls: OverviewUrls | null | undefined,
  diagnostics: OverviewDiagnostics | null | undefined,
  readRemaining: () => Promise<IndexCohortsResponse>,
): Promise<IndexCohortsResponse | null> {
  // The overview already reads this page. Starting the same cold scan twice
  // queues both requests and can exhaust the server's partner deadline.
  if (!urls || !diagnostics)
    return null
  if (urls.pagination.hasMore || urls.urls.length !== urls.pagination.total)
    return readRemaining()
  return buildIndexCohortsFromIndexingUrls({
    urls: urls.urls,
    siteUrl: urls.meta?.siteUrl,
    reportedNotIndexed: diagnostics.issues.find(issue => issue.type === 'not_indexed')?.count ?? 0,
  })
}
