export interface SerpResult {
  url: string
  title: string
  description: string
  position: number
  type: string
}

export interface SerpTaskResult {
  /** Google's estimate of all results for the query. The API has no `total` field. */
  se_results_count?: number
  items?: SerpResult[]
}

/**
 * One Live SERP task, parsed once at the provider boundary. DataForSEO answers
 * HTTP 200 for most failures and puts the error code on the task. A task that
 * ran no search is a `TaskError`, never an empty search. The one exception is
 * 40102 No Search Results: Google ran the search and returned nothing.
 */
export type SerpTask
  = | { _tag: 'Searched', serp: SerpTaskResult }
    | { _tag: 'TaskError', statusCode: number | null, statusMessage: string }

/** DataForSEO's task code for a task that ran. */
const TASK_OK = 20000
/** Google ran the search and returned nothing. For a `site:` search, that is a verdict. */
const TASK_NO_SEARCH_RESULTS = 40102

interface RawStatus {
  status_code?: unknown
  status_message?: unknown
}

interface RawSerpResponse extends RawStatus {
  tasks?: Array<RawStatus & { result?: unknown }> | null
}

/**
 * Read the one task of a Live SERP response. A response without a task carries
 * its error on the envelope, so the envelope status stands in for it.
 */
export function parseSerpTask(response: unknown): SerpTask {
  const envelope = (typeof response === 'object' && response !== null ? response : {}) as RawSerpResponse
  const task = Array.isArray(envelope.tasks) ? envelope.tasks[0] : undefined
  const status = task ?? envelope
  const statusCode = typeof status.status_code === 'number' ? status.status_code : null

  if (statusCode === TASK_NO_SEARCH_RESULTS)
    return { _tag: 'Searched', serp: { items: [] } }

  const serp: unknown = statusCode === TASK_OK && Array.isArray(task?.result) ? task.result[0] : undefined
  if (typeof serp === 'object' && serp !== null)
    return { _tag: 'Searched', serp: serp as SerpTaskResult }

  const statusMessage = typeof status.status_message === 'string' ? status.status_message : 'no status message'
  return { _tag: 'TaskError', statusCode, statusMessage }
}

/**
 * The verdict of one `site:` search. `indexed` is the discriminant: the
 * matched result exists exactly when the URL counts as indexed.
 */
export type IndexCheckResult
  = | { url: string, indexed: true, matchedUrl: string, matchedTitle: string, totalSiteResults: number }
    | { url: string, indexed: false, totalSiteResults: number }

/**
 * Fold a URL to the spelling Google treats as one page. The host loses a
 * leading `www.`, the protocol and fragment drop, one trailing slash drops, and
 * the query string stays. The URL parser already lowercases the host.
 * Percent-encoding hex is uppercased, because RFC 3986 makes `%d8` and `%D8`
 * the same octet and WordPress writes non-Latin slugs in lowercase hex.
 * An unparseable URL has no key, so it never matches.
 */
function siteSearchKey(raw: string): string | null {
  if (!URL.canParse(raw))
    return null
  const url = new URL(raw)
  const host = url.host.replace(/^www\./, '')
  const path = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
  return `${host}${path}${url.search}`.replace(/%[0-9a-f]{2}/gi, octet => octet.toUpperCase())
}

/**
 * Decide whether a `site:` search shows the checked URL in Google's index.
 * `site:` matches by prefix, so it also returns other URLs under the same path.
 * Only an organic result that is the checked URL itself counts. The search
 * must have run: `parseSerpTask` keeps a task error away from this verdict.
 */
export function matchSiteSearch(url: string, serp: SerpTaskResult): IndexCheckResult {
  const totalSiteResults = serp?.se_results_count || 0
  const key = siteSearchKey(url)
  const match = key === null
    ? undefined
    : serp?.items?.find(item => item.type === 'organic' && siteSearchKey(item.url) === key)

  if (!match)
    return { url, indexed: false, totalSiteResults }
  return { url, indexed: true, matchedUrl: match.url, matchedTitle: match.title, totalSiteResults }
}
