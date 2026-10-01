export interface SerpResult {
  url: string
  title: string
  description: string
  position: number
  type: string
}

export interface SerpTaskResult {
  total?: number
  items?: SerpResult[]
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
 * Only an organic result that is the checked URL itself counts.
 */
export function matchSiteSearch(url: string, serp: SerpTaskResult | undefined): IndexCheckResult {
  const totalSiteResults = serp?.total || 0
  const key = siteSearchKey(url)
  const match = key === null
    ? undefined
    : serp?.items?.find(item => item.type === 'organic' && siteSearchKey(item.url) === key)

  if (!match)
    return { url, indexed: false, totalSiteResults }
  return { url, indexed: true, matchedUrl: match.url, matchedTitle: match.title, totalSiteResults }
}
