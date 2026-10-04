import type { IndexCohortsResponse } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readIndexingUrlPages } from '#layers/pro-indexing/server/utils/indexing-url-pages'
import { buildIndexCohortsFromIndexingUrls } from '#layers/pro-indexing/shared/index-cohort-source'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Which part of this site does Google treat worse than the rest?
//
// The reason taxonomy Search Console publishes ("37 crawled but not indexed")
// names a symptom the developer cannot act on. Partitioning the inspected set
// by path and asking which partition Google treats differently names a place
// they can. The join, the Wilson intervals and the Bonferroni correction all
// live in `shared/index-cohort-source.ts`, so this handler only fetches.
//
// The cohort test needs the WHOLE inspected set, not a page of it: a partial
// sample would rank sections by which rows happened to load. The read is paged
// because the gscdump contract caps one read at 500 rows, and a set bigger than
// the ceiling below answers `no-evidence` rather than a ranking built on half
// the data.
//
// The diagnostics read supplies the not-indexed count gscdump reports. The
// builder compares it with the not-indexed rows the list enumerated, and
// refuses a rate when the list is a sample of that count.

/** Above this the inspection set is too large to compare honestly in a request. */
const MAX_COHORT_URLS = 2000

export default defineProApiHandler({ site: true }, async ({ site: access }): Promise<IndexCohortsResponse> => {
  const gscdumpSiteId = access.site.gscdumpSiteId
  if (!gscdumpSiteId)
    return { _tag: 'no-evidence', crawlSettingsId: null, asOf: null, reason: 'no-inspection-join', sample: null }

  const client = useGscdumpClient()
  const [scan, diagnostics] = await Promise.all([
    readIndexingUrlPages(
      page => client.getIndexingUrls(gscdumpSiteId, { limit: page.limit, offset: page.offset }),
      { maxUrls: MAX_COHORT_URLS },
    ),
    client.getIndexingDiagnostics(gscdumpSiteId),
  ])

  if (scan._tag === 'truncated')
    return { _tag: 'no-evidence', crawlSettingsId: null, asOf: null, reason: 'no-inspection-join', sample: null }

  return buildIndexCohortsFromIndexingUrls(
    {
      urls: scan.urls,
      siteUrl: scan.siteUrl ?? access.site.property,
      reportedNotIndexed: diagnostics.issues.find(issue => issue.type === 'not_indexed')?.count ?? 0,
    },
    new Date().toISOString(),
  )
})
