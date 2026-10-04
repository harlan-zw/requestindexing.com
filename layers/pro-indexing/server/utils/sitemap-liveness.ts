import type { SitemapLiveness } from '../../shared/contracts/sitemap-liveness'

// The sitemap liveness probe. gscdump reports what Google last managed to
// fetch; this asks the origin right now. A sitemap that hangs or 404s while
// Search Console still serves a week-old copy is the failure the trust gate
// needs, and only a live probe can see it.
//
// nuxtseo.com runs the same probe on top of its crawler stack (zone-safe fetch,
// the shared XML validator, a Nitro SWR cache). request-indexing has none of
// those, so this port keeps the classification and drops content validation:
// `status`, `statusCode`, `durationMs` and `checkedAt` are the fields the trust
// gate reads, and every one of them comes from the transport.
//
// Pure core, effectful shell: `probeSitemap` takes its fetch and clock as
// arguments, so every branch is unit-tested without a network.

/** Hard cap on one probe. A sitemap slower than this is timing out. */
export const PROBE_TIMEOUT_MS = 15_000
const PROBE_ACCEPT = 'application/xml,text/xml,application/rss+xml'
const MAX_REDIRECTS = 5
/** How many children of a sitemap index to sample. A live index with dead children is not healthy. */
const MAX_CHILD_PROBES = 3

export interface SitemapProbeDeps {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  now?: () => number
}

interface ProbeFetch extends SitemapLiveness {
  body: string | null
  url: string
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false
  const name = (error as { name?: unknown }).name
  return name === 'TimeoutError' || name === 'AbortError'
}

/**
 * Hostnames the probe refuses. The submitted sitemap URL arrives from a query
 * string, so without this the endpoint is a request forwarder onto the private
 * network. Same-origin alone is not enough: a site can resolve to a loopback
 * address in development.
 */
const PRIVATE_HOST = /^(?:localhost|.*\.local|.*\.internal|\[?::1\]?|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/i

export function isPublicProbeTarget(target: string): boolean {
  try {
    const url = new URL(target)
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      return false
    return !PRIVATE_HOST.test(url.hostname)
  }
  catch {
    return false
  }
}

/**
 * The http(s) origin to probe, or null.
 *
 * Registered hosts and Search Console domain properties use HTTPS.
 * Explicit URLs keep their protocol. Unsupported protocols return null.
 */
export function probeOrigin(siteUrl: string): string | null {
  const candidate = siteUrl.startsWith('sc-domain:')
    ? `https://${siteUrl.slice('sc-domain:'.length)}`
    : /^[^/?#:@\s]+(?::\d+)?$/.test(siteUrl) ? `https://${siteUrl}` : siteUrl
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  }
  catch {
    return null
  }
}

/** `Sitemap:` directives declared in a robots.txt body. */
export function parseRobotsSitemaps(body: string): string[] {
  return body
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line)
      return match?.[1] ? [match[1]] : []
    })
}

/** Child sitemap locations declared by a `<sitemapindex>` document, or null when it is not one. */
export function parseSitemapIndexChildren(xml: string): string[] | null {
  if (!/<sitemapindex[\s>]/i.test(xml))
    return null
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].flatMap(match => match[1] ? [match[1]] : [])
}

/**
 * Probe a site's sitemap and classify the outcome:
 *   - `reachable` the entry sitemap, and any sampled children, answered 2xx,
 *   - `timeout` the probe budget expired, the hanging-sitemap tell,
 *   - `error` a non-2xx response or a transport failure.
 *
 * If `submittedSitemapUrl` is given, that exact URL is the entry: it is the one
 * Google fetches, so a 404 there is a real failure and there is no fallback to
 * a guess. Otherwise discovery mirrors Google: try `/sitemap.xml`, and on a
 * clean 404 fall back to the `Sitemap:` lines in robots.txt, then the common
 * index filenames.
 *
 * A single failure never decides the trust gate on its own. `computeTrustGate`
 * requires corroboration before it reports `broken`.
 */
export async function probeSitemap(
  siteUrl: string,
  deps: SitemapProbeDeps = {},
  submittedSitemapUrl?: string,
): Promise<SitemapLiveness> {
  const doFetch = deps.fetch ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init))
  const now = deps.now ?? Date.now

  const resolved = probeOrigin(siteUrl)
  if (!resolved)
    return { status: 'error', statusCode: null, durationMs: 0, checkedAt: new Date(now()).toISOString() }
  const origin: string = resolved

  async function fetchOnce(target: string): Promise<ProbeFetch> {
    const startedAt = now()
    const checkedAt = new Date(startedAt).toISOString()
    let current = target
    try {
      const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS)
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        if (!isPublicProbeTarget(current))
          return { status: 'error', statusCode: null, durationMs: now() - startedAt, checkedAt, body: null, url: current }

        const response = await doFetch(current, {
          redirect: 'manual',
          signal,
          headers: { accept: PROBE_ACCEPT },
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location || redirects === MAX_REDIRECTS)
            return { status: 'error', statusCode: response.status, durationMs: now() - startedAt, checkedAt, body: null, url: current }
          current = new URL(location, current).toString()
          continue
        }
        if (!response.ok)
          return { status: 'error', statusCode: response.status, durationMs: now() - startedAt, checkedAt, body: null, url: current }

        return {
          status: 'reachable',
          statusCode: response.status,
          durationMs: now() - startedAt,
          checkedAt,
          body: await response.text(),
          url: current,
        }
      }
      // The loop above always returns; this keeps the compiler honest.
      return { status: 'error', statusCode: null, durationMs: now() - startedAt, checkedAt, body: null, url: current }
    }
    catch (error: unknown) {
      return {
        status: isTimeoutError(error) ? 'timeout' : 'error',
        statusCode: null,
        durationMs: now() - startedAt,
        checkedAt,
        body: null,
        url: current,
      }
    }
  }

  function sameOrigin(candidate: string): string | null {
    try {
      const url = new URL(candidate, origin)
      return url.origin === origin ? url.toString() : null
    }
    catch {
      return null
    }
  }

  const submitted = submittedSitemapUrl ? sameOrigin(submittedSitemapUrl) : null
  let entry: ProbeFetch
  if (submitted) {
    entry = await fetchOnce(submitted)
  }
  else {
    entry = await fetchOnce(`${origin}/sitemap.xml`)
    if (entry.statusCode === 404) {
      const robots = await fetchOnce(`${origin}/robots.txt`)
      const declared = robots.status === 'reachable' && robots.body ? parseRobotsSitemaps(robots.body) : []
      let declaredFailure: ProbeFetch | null = null
      for (const candidate of declared) {
        const target = sameOrigin(candidate)
        if (!target)
          continue
        const alternative = await fetchOnce(target)
        if (alternative.status === 'reachable') {
          entry = alternative
          break
        }
        if (!(alternative.status === 'error' && alternative.statusCode === 404))
          declaredFailure ??= alternative
      }
      if (entry.statusCode === 404 && declaredFailure) {
        entry = declaredFailure
      }
      else if (entry.statusCode === 404) {
        for (const candidate of [`${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`]) {
          const alternative = await fetchOnce(candidate)
          if (alternative.status === 'reachable') {
            entry = alternative
            break
          }
        }
      }
    }
  }

  const base: SitemapLiveness = {
    status: entry.status,
    statusCode: entry.statusCode,
    durationMs: entry.durationMs,
    checkedAt: entry.checkedAt,
    url: entry.url,
  }
  if (entry.status !== 'reachable' || !entry.body)
    return base

  const children = parseSitemapIndexChildren(entry.body)
  if (!children)
    return base

  for (const child of children.slice(0, MAX_CHILD_PROBES)) {
    const target = sameOrigin(child)
    if (!target)
      continue
    const probe = await fetchOnce(target)
    if (probe.status !== 'reachable') {
      return {
        ...base,
        status: probe.status,
        statusCode: probe.statusCode,
        durationMs: probe.durationMs,
        warnings: [`Sitemap index is reachable but a child sitemap is ${probe.status}: ${child}`],
      }
    }
  }
  return base
}
