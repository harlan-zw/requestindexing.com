// Ported from nuxtseo.com `layers/pro/gsc/shared/site-indexing-issues.ts`.
//
// One change: gscdump's `totalUrls` is the inspected set here, as the per-Site
// Indexing page already says ("Inspected sample, not whole-site coverage"). The
// empty-breakdown copy says "inspected" where upstream says "submitted".

export interface SiteIndexingTrendIssuePoint {
  issues?: {
    notFound?: number
    soft404?: number
    serverError?: number
    blockedByRobots?: number
  }
  /**
   * "Google knows about it and chose not to index it" counts. These are the
   * reasons behind the gap between inspected and indexed on a site with zero
   * hard crawl errors. Without them a healthy-crawling site with 60 unindexed
   * URLs rendered an empty breakdown.
   */
  coverage?: {
    crawledNotIndexed?: number
    discoveredNotCrawled?: number
  }
  signals?: {
    richResultsFail?: number
  }
}

export interface SiteIndexingIssueSummary {
  indexed: number
  totalUrls: number
}

/** A zero denominator means Search Console has not supplied an observation yet. */
export function hasIndexingCoverageObservation(
  summary: SiteIndexingIssueSummary | null | undefined,
): summary is SiteIndexingIssueSummary {
  return !!summary && summary.totalUrls > 0
}

export interface SiteIndexingIssue {
  id: string
  label: string
  count: number
  filter: { key: 'issue' | 'facet', value: string }
}

interface IssueSpec extends Omit<SiteIndexingIssue, 'count'> {
  /** Sort rank: 0 = actionable failure, 1 = attention. Ties break on count. */
  rank: number
  pick: (point: SiteIndexingTrendIssuePoint) => number | undefined
}

// Only rows a user can act on. The SDK's "Expected behaviour" group (noindex,
// redirect, alternate canonical) is deliberately absent: a row offering to
// "fix" an intentional redirect is noise, and every row here carries a fix
// affordance.
const ISSUE_SPECS: IssueSpec[] = [
  { id: 'server-error', label: 'Server error', rank: 0, pick: p => p.issues?.serverError, filter: { key: 'issue', value: 'server_error' } },
  { id: 'not-found', label: 'Not found', rank: 0, pick: p => p.issues?.notFound, filter: { key: 'issue', value: 'not_found' } },
  { id: 'soft-404', label: 'Soft 404', rank: 0, pick: p => p.issues?.soft404, filter: { key: 'issue', value: 'soft_404' } },
  { id: 'crawled-not-indexed', label: 'Crawled, not indexed', rank: 0, pick: p => p.coverage?.crawledNotIndexed, filter: { key: 'issue', value: 'crawled_not_indexed' } },
  { id: 'discovered-not-indexed', label: 'Discovered, not crawled', rank: 1, pick: p => p.coverage?.discoveredNotCrawled, filter: { key: 'issue', value: 'discovered_not_indexed' } },
  { id: 'blocked-robots', label: 'Blocked by robots.txt', rank: 1, pick: p => p.issues?.blockedByRobots, filter: { key: 'issue', value: 'blocked_robots' } },
  { id: 'rich-results', label: 'Rich result errors', rank: 1, pick: p => p.signals?.richResultsFail, filter: { key: 'facet', value: 'rich_results' } },
]

/** Project the latest indexing trend point into the actionable positive-count rows. */
export function getSiteIndexingIssues(point: SiteIndexingTrendIssuePoint | null | undefined): SiteIndexingIssue[] {
  if (!point)
    return []

  return ISSUE_SPECS
    .map(spec => ({ ...spec, count: spec.pick(point) ?? 0 }))
    .filter(issue => issue.count > 0)
    .sort((a, b) => a.rank - b.rank || b.count - a.count)
    .map(({ id, label, count, filter }) => ({ id, label, count, filter }))
}

/**
 * Why a site shows no rows. An empty breakdown has three very different causes
 * and a bare "nothing yet" placeholder claims the wrong one: a fully indexed
 * site is a clean bill, an unsynced site has no observation at all, and a site
 * with unindexed URLs but no attributed reason is a coverage limit of the URL
 * Inspection sample, not a green tick.
 */
export function describeEmptyIndexingBreakdown(
  point: SiteIndexingTrendIssuePoint | null | undefined,
  summary: SiteIndexingIssueSummary | null | undefined,
): string {
  if (!point || !hasIndexingCoverageObservation(summary))
    return 'Google has not reported coverage for this Site yet. The breakdown appears after the first Search Console sync.'

  const unindexed = Math.max(0, summary.totalUrls - summary.indexed)
  if (unindexed === 0)
    return 'Every inspected URL is indexed, so there is nothing to break down.'

  return `Google has not attributed a reason to the ${unindexed.toLocaleString('en-US')} URL${unindexed === 1 ? '' : 's'} it has not indexed.`
}

/**
 * True when the site has unindexed URLs but no categorised reason: the one
 * empty case worth a doorway into the per-site report.
 */
export function hasUnexplainedUnindexedUrls(
  summary: SiteIndexingIssueSummary | null | undefined,
): boolean {
  return !!summary && summary.totalUrls - summary.indexed > 0
}

/** `siteRef` is the Site's route id (its `s_` public id). */
export function buildSiteIndexingIssueRoute(siteRef: string, issue: SiteIndexingIssue): string {
  return `/pro/dashboard/sites/${siteRef}/indexing/urls?${issue.filter.key}=${encodeURIComponent(issue.filter.value)}`
}

export function buildSiteIndexingRoute(siteRef: string): string {
  return `/pro/dashboard/sites/${siteRef}/indexing`
}
