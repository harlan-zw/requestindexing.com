// Read the whole URL Inspection set for a site.
//
// `partner.sites.indexing.urls.list` caps `limit` at 500. Asking for more is a
// contract violation, not a large read: the operation answers 400 and the
// caller gets nothing. The cohort test needs the whole inspected set, so this
// walks the pages instead and reports honestly when the set is bigger than the
// caller is willing to hold.
//
// The row type is the reader's, not this module's: paging is about pagination,
// and pinning the SDK's inspection row here would only add a cast at the call
// site every time that row gains a field.

/** The largest `limit` the gscdump contract accepts for one read. */
export const INDEXING_URLS_PAGE_LIMIT = 500

export interface IndexingUrlPageRequest {
  limit: number
  offset: number
}

/** The part of an indexing-urls response paging needs. */
export interface IndexingUrlPage<Url> {
  urls: Url[]
  pagination: { total: number, hasMore: boolean }
  meta?: { siteUrl?: string } | null
}

export type IndexingUrlPageReader<Url> = (page: IndexingUrlPageRequest) => Promise<IndexingUrlPage<Url>>

/**
 * `complete` carries every inspected URL for the site, in the order gscdump
 * ranked them. `truncated` means the set is bigger than `maxUrls`, so the rows
 * read are a sample and not a whole answer.
 */
export type IndexingUrlScan<Url>
  = | { _tag: 'complete', urls: Url[], siteUrl: string | null }
    | { _tag: 'truncated', loaded: number, total: number }

export interface ReadIndexingUrlPagesOptions {
  /** Stop and report truncation once this many rows are loaded. */
  maxUrls: number
  /** Rows per read. Never above the contract cap. */
  pageLimit?: number
}

/**
 * Page through the inspection set with an injected reader.
 *
 * A page that comes back empty ends the walk even when the response still says
 * `hasMore`, so a stale or wrong pagination flag costs one extra read rather
 * than an unbounded loop.
 */
export async function readIndexingUrlPages<Url>(
  read: IndexingUrlPageReader<Url>,
  { maxUrls, pageLimit = INDEXING_URLS_PAGE_LIMIT }: ReadIndexingUrlPagesOptions,
): Promise<IndexingUrlScan<Url>> {
  const limit = Math.max(1, Math.min(pageLimit, INDEXING_URLS_PAGE_LIMIT))
  const urls: Url[] = []
  let siteUrl: string | null = null
  let total = 0

  while (urls.length < maxUrls) {
    const response = await read({ limit, offset: urls.length })
    siteUrl = response.meta?.siteUrl ?? siteUrl
    total = response.pagination.total || total
    urls.push(...response.urls)

    if (!response.urls.length)
      return { _tag: 'truncated', loaded: urls.length, total: Math.max(total, urls.length) }
    if (!response.pagination.hasMore)
      return { _tag: 'complete', urls, siteUrl }
  }

  return { _tag: 'truncated', loaded: urls.length, total: Math.max(total, urls.length) }
}
