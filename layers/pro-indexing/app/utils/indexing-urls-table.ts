import type { IssueSeverity } from '@gscdump/sdk/indexing-issues'
import type {
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingUrl,
  GscdumpInspectRateLimited,
  GscdumpInspectResponse,
} from '#layers/pro-gsc/shared/gscdump-api'
import { severityOrder } from '@gscdump/sdk/indexing-issues'

/**
 * Pure reads behind the URLs table (`TableIndexingUrls.vue`). Every value comes
 * from gscdump's URL Inspection rows and diagnostics; nothing here reads a
 * crawl or a local collection.
 *
 * Ported from the inline helpers in nuxtseo.com
 * `layers/pro/gsc/app/internal/components/TableIndexingUrls.vue`.
 */

export type DiagnosticsIssue = GscdumpIndexingDiagnosticsResponse['issues'][number]

export interface IssueSeverityGroup {
  severity: IssueSeverity
  issues: DiagnosticsIssue[]
  /** URLs across every issue in the group. One URL can carry several issues. */
  total: number
}

/**
 * The issue filter's groups: errors, then warnings, then info. An issue with no
 * URLs is left out, and so is a group with no issues left.
 */
export function groupIssuesBySeverity(issues: readonly DiagnosticsIssue[]): IssueSeverityGroup[] {
  return severityOrder.flatMap((severity) => {
    const grouped = issues.filter(issue => issue.severity === severity && issue.count > 0)
    if (!grouped.length)
      return []
    return [{ severity, issues: grouped, total: grouped.reduce((sum, issue) => sum + issue.count, 0) }]
  })
}

/**
 * The count on the Issues button. Errors win over warnings; info alone shows no
 * count, because nothing there needs a fix.
 */
export function issueButtonCount(groups: readonly IssueSeverityGroup[]): { severity: 'error' | 'warning', count: number } | null {
  const error = groups.find(group => group.severity === 'error')
  if (error)
    return { severity: 'error', count: error.total }
  const warning = groups.find(group => group.severity === 'warning')
  return warning ? { severity: 'warning', count: warning.total } : null
}

export type InspectionSeverity = 'success' | 'error' | 'warning' | 'neutral'

/**
 * Severity of one URL Inspection enum value. Google's `*_UNSPECIFIED` values
 * and the `NEUTRAL` verdict say nothing either way, so they read as neutral.
 */
export function inspectionStateSeverity(raw: string | null | undefined, successValues: readonly string[]): InspectionSeverity {
  if (!raw || raw.includes('UNSPECIFIED') || raw === 'NEUTRAL')
    return 'neutral'
  return successValues.includes(raw) ? 'success' : 'error'
}

export const verdictLabels: Record<string, string> = {
  PASS: 'Indexed',
  FAIL: 'Not indexed',
  PARTIAL: 'Partial',
  NEUTRAL: 'Not indexed',
  VERDICT_UNSPECIFIED: 'Unknown',
}

export const indexingStateLabels: Record<string, string> = {
  INDEXING_ALLOWED: 'Allowed',
  INDEXING_NOT_ALLOWED: 'Not allowed',
  INDEXING_STATE_UNSPECIFIED: 'Unknown',
}

export const robotsTxtStateLabels: Record<string, string> = {
  ALLOWED: 'Allowed',
  DISALLOWED: 'Blocked',
  ROBOTS_TXT_STATE_UNSPECIFIED: 'Unknown',
}

export const pageFetchStateLabels: Record<string, string> = {
  SUCCESSFUL: 'Successful',
  SOFT_404: 'Soft 404',
  SERVER_ERROR: 'Server error',
  REDIRECT_ERROR: 'Redirect error',
  ACCESS_DENIED: 'Access denied',
  BLOCKED_ROBOTS_TXT: 'Blocked by robots',
  NOT_FOUND: 'Not found',
  PAGE_FETCH_STATE_UNSPECIFIED: 'Unknown',
}

export const crawlerLabels: Record<string, string> = {
  DESKTOP: 'Desktop',
  MOBILE: 'Mobile',
  CRAWLING_USER_AGENT_UNSPECIFIED: 'Unknown',
}

/**
 * A readable label for a URL Inspection enum value. A value the map does not
 * know is title-cased rather than hidden, so a new Google state still shows.
 */
export function inspectionStateLabel(raw: string | null | undefined, labels: Record<string, string>): string {
  if (!raw)
    return 'Unknown'
  const known = labels[raw]
  if (known)
    return known
  const words = raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s(?:Unspecified|State)\b/gi, '')
    .trim()
  return words || 'Unknown'
}

// Short labels for Google's coverage state strings.
const coverageShortLabels: Record<string, string> = {
  'Submitted and indexed': 'Indexed',
  'Indexed, not submitted in sitemap': 'Indexed (no sitemap)',
  'Crawled - currently not indexed': 'Crawled, not indexed',
  'Discovered - currently not indexed': 'Discovered, not indexed',
  'URL is unknown to Google': 'Unknown to Google',
  'Page with redirect': 'Redirect',
  'Blocked by robots.txt': 'Blocked (robots)',
  'Excluded by \'noindex\' tag': 'Noindex',
  'Soft 404': 'Soft 404',
  'Not found (404)': '404',
  'Server error (5xx)': 'Server error',
  'Duplicate without user-selected canonical': 'Duplicate',
  'Duplicate, Google chose different canonical than user': 'Canonical mismatch',
  'Alternate page with proper canonical tag': 'Canonical alternate',
  'Blocked due to unauthorized request (401)': 'Auth required',
  'Blocked due to access forbidden (403)': 'Forbidden',
}

/** The coverage column's short label, or `null` when Google reported none. */
export function shortCoverage(raw: string | null | undefined): string | null {
  if (!raw)
    return null
  return coverageShortLabels[raw] ?? raw
}

/**
 * Sitemap membership as Google reports it in the coverage state. `true`: Google
 * saw the URL in a submitted sitemap. `false`: Google knows the URL and it is
 * not in the current sitemap. `null`: the coverage state does not say.
 */
export function sitemapMembership(url: Pick<GscdumpIndexingUrl, 'coverageState'>): boolean | null {
  const coverage = url.coverageState?.toLowerCase() ?? ''
  if (!coverage)
    return null
  if (coverage.includes('not submitted in sitemap'))
    return false
  if (coverage.includes('submitted'))
    return true
  return null
}

/**
 * True when the URL carries rich result evidence: typed items, or a verdict
 * that is not one of Google's neutral placeholders.
 */
export function hasRichResult(url: Pick<GscdumpIndexingUrl, 'richResultsItems' | 'richResultsVerdict'>): boolean {
  if (url.richResultsItems?.length)
    return true
  const verdict = url.richResultsVerdict
  return !!verdict && !verdict.includes('UNSPECIFIED') && verdict !== 'NEUTRAL'
}

export interface RichResultDistributionRow {
  type: string
  valid: number
  invalid: number
}

/**
 * Rich result types across the loaded rows. A `PASS` verdict counts each of the
 * URL's types as valid; `FAIL` and `PARTIAL` count them as invalid. The v1
 * protocol has no aggregate for this, so it covers the current page only.
 */
export function richResultsDistribution(
  urls: ReadonlyArray<Pick<GscdumpIndexingUrl, 'richResultsItems' | 'richResultsVerdict'>>,
): RichResultDistributionRow[] {
  const byType = new Map<string, RichResultDistributionRow>()
  for (const url of urls) {
    if (!url.richResultsItems?.length)
      continue
    const valid = url.richResultsVerdict === 'PASS'
    const invalid = url.richResultsVerdict === 'FAIL' || url.richResultsVerdict === 'PARTIAL'
    if (!valid && !invalid)
      continue
    for (const item of url.richResultsItems) {
      const type = item.richResultType
      if (!type)
        continue
      const entry = byType.get(type) ?? { type, valid: 0, invalid: 0 }
      if (valid)
        entry.valid++
      else
        entry.invalid++
      byType.set(type, entry)
    }
  }
  return [...byType.values()].sort((a, b) => (b.invalid - a.invalid) || (b.valid - a.valid))
}

const crawlDayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The Last crawl cell. Dates are read in UTC so the server render and the
 * browser agree; the table renders on the server when its first page is seeded.
 */
export function formatCrawlDay(value: string | null | undefined, now: Date): string | null {
  if (!value)
    return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return null
  const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const days = Math.round((utcDay(now) - utcDay(date)) / DAY_MS)
  if (days === 0)
    return 'Today'
  if (days === 1)
    return 'Yesterday'
  return crawlDayFormat.format(date)
}

/** "in about 5 hours", from gscdump's `retryAfterSeconds`. */
export function retryAfterLabel(seconds: number): string {
  const hours = Math.round(seconds / 3600)
  if (hours < 1)
    return 'in less than an hour'
  return hours === 1 ? 'in about 1 hour' : `in about ${hours} hours`
}

export type InspectOutcome
  = | { _tag: 'RateLimited', retryAfterSeconds: number }
    | { _tag: 'Checked', coverage: string, remaining: number, limit: number }
    | { _tag: 'Failed', reason: string, remaining: number, limit: number }

/**
 * What one `inspect.create` call for one URL means for the reader. The engine
 * can answer with a result, an error, or a skip; a skip is a failed check too,
 * because the reader asked for a result and got none.
 */
export function readInspectOutcome(response: GscdumpInspectResponse | GscdumpInspectRateLimited): InspectOutcome {
  if ('error' in response)
    return { _tag: 'RateLimited', retryAfterSeconds: response.retryAfterSeconds }
  const { remaining, limit } = response.rateLimit
  const result = response.results[0]
  if (result)
    return { _tag: 'Checked', coverage: result.coverageState ?? verdictLabels[result.verdict ?? ''] ?? 'Updated', remaining, limit }
  const failure = response.errors[0]?.error ?? response.skipped[0]?.reason
  return { _tag: 'Failed', reason: failure ?? 'URL Inspection returned no result for this URL. Try again later.', remaining, limit }
}
