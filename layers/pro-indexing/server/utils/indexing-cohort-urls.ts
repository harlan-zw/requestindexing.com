import type { IndexCohortFilter } from '../../shared/contracts/index-cohorts'
import type { IndexCohortSource } from '../../shared/index-cohort-source'
import type { IndexingUrlPageReader } from './indexing-url-pages'
import { selectIndexCohortUrls } from '../../shared/index-cohort-source'
import { readIndexingUrlPages } from './indexing-url-pages'

export async function readIndexingCohortUrls<Url extends IndexCohortSource['urls'][number]>(
  read: IndexingUrlPageReader<Url>,
  query: { cohort: IndexCohortFilter, limit: number, offset: number, search?: string },
  fallbackSiteUrl: string,
) {
  const scan = await readIndexingUrlPages(read, { maxUrls: 2000 })
  if (scan._tag === 'truncated')
    return scan
  const siteUrl = scan.siteUrl ?? fallbackSiteUrl
  const rows = selectIndexCohortUrls(scan.urls, query.cohort, siteUrl)
    .filter(row => !query.search || row.url.toLowerCase().includes(query.search.toLowerCase()))
  return {
    _tag: 'complete' as const,
    data: {
      urls: rows.slice(query.offset, query.offset + query.limit),
      pagination: { total: rows.length, limit: query.limit, offset: query.offset, hasMore: query.offset + query.limit < rows.length },
      meta: { siteUrl, status: 'not_indexed', issue: null },
    },
  }
}
