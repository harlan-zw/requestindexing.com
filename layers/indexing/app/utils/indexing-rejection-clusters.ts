// Which part of the Site is Google refusing?
//
// Ported from gscdump.com `layers/pro-gsc/app/utils/indexing/rejection-clusters.ts`.
//
// nuxtseo.com answers this from its own crawl plus a traffic join, so it can tag
// a cluster "prune". This app has neither, so this groups the refused URLs by
// their first path segment and stops there. No prune tag: that claim needs
// traffic per cluster, and a wrong one tells someone to delete pages that earn
// clicks.
//
// Why the first segment: a refusal is almost always a route family, not a page.
// `/tag/*`, `/author/*` and `/search/*` are the sets a developer can act on in
// one change. A deeper key splits one decision into twenty rows.

/** One inspected URL, as far as clustering is concerned. */
export interface RejectionClusterRow {
  url: string
  issueType?: string | null
}

export interface RejectionCluster {
  /** The grouping key, for example `/tag/*`. Stable enough to deep link on. */
  pathPattern: string
  /** Rejected URLs in this cluster. */
  count: number
  /** This cluster's share of the rejected set, from 0 to 1. */
  share: number
  /** Up to three URLs, so the reader can check the cluster is what they think. */
  sampleUrls: string[]
}

export interface RejectionClusterReport {
  clusters: RejectionCluster[]
  /** Every refused URL in the sample. */
  rejectedTotal: number
  /** Refused URLs that landed in a returned cluster. */
  clusteredTotal: number
}

/**
 * The refusal buckets, in the order they explain each other. Google fetched these
 * and refused, Google found these and never fetched, Google got an empty page.
 */
export const REJECTION_ISSUE_TYPES = ['crawled_not_indexed', 'discovered_not_indexed', 'soft_404'] as const

export interface ClusterRejectedUrlsOptions {
  /** Drop clusters smaller than this. A cluster of one is a page, not a set. */
  minClusterSize?: number
  /** Keep at most this many clusters, largest first. */
  limit?: number
  /** Restrict to these issue types. Defaults to the three refusal buckets. */
  issueTypes?: readonly string[]
}

function pathPatternFor(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]
  if (!first)
    return '/'
  return segments.length > 1 ? `/${first}/*` : `/${first}`
}

export function clusterRejectedUrls(
  rows: readonly RejectionClusterRow[],
  options: ClusterRejectedUrlsOptions = {},
): RejectionClusterReport {
  const minClusterSize = options.minClusterSize ?? 2
  const limit = options.limit ?? 8
  const wanted = new Set(options.issueTypes ?? REJECTION_ISSUE_TYPES)

  const byPattern = new Map<string, { count: number, sampleUrls: string[] }>()
  let rejectedTotal = 0

  for (const row of rows) {
    if (!row.issueType || !wanted.has(row.issueType))
      continue
    if (!URL.canParse(row.url))
      continue
    rejectedTotal++
    const pattern = pathPatternFor(new URL(row.url).pathname)
    const bucket = byPattern.get(pattern) ?? { count: 0, sampleUrls: [] }
    bucket.count++
    if (bucket.sampleUrls.length < 3)
      bucket.sampleUrls.push(row.url)
    byPattern.set(pattern, bucket)
  }

  const clusters = [...byPattern.entries()]
    .filter(([, bucket]) => bucket.count >= minClusterSize)
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([pathPattern, bucket]) => ({
      pathPattern,
      count: bucket.count,
      // Share of the whole refused set, not of the clustered part, so the numbers
      // on screen never add up to more than the total the page reports.
      share: rejectedTotal > 0 ? bucket.count / rejectedTotal : 0,
      sampleUrls: bucket.sampleUrls,
    }))

  return {
    clusters,
    rejectedTotal,
    clusteredTotal: clusters.reduce((total, cluster) => total + cluster.count, 0),
  }
}
