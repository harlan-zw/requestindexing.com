import type { H3Event } from 'h3'
import type { DataForSeoSpendEnv } from './dataforseo-spend'
import type { IndexCheckResult, SerpTaskResult } from './site-search'
import { createError } from 'h3'
import {
  DATAFORSEO_RETRY_OPTIONS,
  DATAFORSEO_UNAVAILABLE_MESSAGE,
  dataForSeoStatusCode,
  isTransientDataForSeoFailure,
} from '../../../../../shared/dataforseo'
import { dataForSeoSpendEnv, recordDataForSeoSpend } from './dataforseo-spend'
import { matchSiteSearch } from './site-search'

export interface DataForSeoCallContext extends DataForSeoSpendEnv {
  /** Tool name for spend attribution, e.g. 'check-index'. Omitted = unmetered. */
  tool?: string
  /** Request event, for the caller-IP hash on the ledger row. */
  event?: H3Event
  /** API credentials resolved once at the route boundary. */
  credentials?: DataForSEOCredentials
  /** Provider transport resolved at the route boundary. */
  providerFetch?: typeof $fetch
}

/**
 * Build the per-call context the route seam hands to every service function:
 * the spend env plus attribution. `tool` omitted means the call is internal and
 * still metered through the shared budget (env only, no ledger attribution).
 */
export function dataForSeoCallContext(tool: string, event?: H3Event): DataForSeoCallContext {
  return { tool, event, credentials: getCredentials(), providerFetch: $fetch, ...dataForSeoSpendEnv() }
}

interface DataForSEOCredentials {
  login: string
  password: string
}

interface DataForSeoResponse<T> {
  status_code?: number
  cost?: number
  tasks?: Array<{ result?: T[], cost?: number }>
}

function tagHash(value: string): string {
  let hash = 0x811C9DC5
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function boundedTagValue(value: string, maxLength: number): string {
  const encoded = encodeURIComponent(value)
  if (encoded.length <= maxLength)
    return encoded

  const suffix = `~${tagHash(value)}`
  let prefix = value
  while (prefix && encodeURIComponent(prefix).length + suffix.length > maxLength)
    prefix = prefix.slice(0, -1)
  return `${encodeURIComponent(prefix)}${suffix}`
}

function taskSite(task: Record<string, unknown>): string | null {
  const candidate = typeof task.target === 'string'
    ? task.target
    : typeof task.keyword === 'string' && task.keyword.startsWith('site:')
      ? task.keyword.slice(5).split(/\s/, 1)[0] ?? ''
      : ''
  if (!candidate)
    return null

  const url = candidate.includes('://') ? candidate : `https://${candidate}`
  return URL.canParse(url) ? new URL(url).hostname : null
}

/** Add provider-visible cost attribution to every task in a request. */
export function tagDataForSeoTasks<T extends Record<string, unknown>>(
  tasks: T[],
  source: string,
  requestId: string,
): Array<T & { tag: string }> {
  return tasks.map((task, index) => ({
    ...task,
    tag: [
      'v=1',
      'app=request-indexing.com',
      `site=${boundedTagValue(taskSite(task) ?? 'unscoped', 80)}`,
      `source=${boundedTagValue(source, 48)}`,
      `request=${boundedTagValue(requestId, 48)}`,
      `task=${index}`,
    ].join('&'),
  }))
}

interface DomainRankResult {
  items?: Array<{
    metrics?: { organic?: { etv?: number, count?: number } }
  }>
}

export interface DomainOverviewResult {
  domain: string
  organicTraffic: number
  organicKeywords: number
  estimatedIndexedPages: number
  topPages: Array<{ url: string, traffic: number, keywords: number }>
}

function getCredentials(): DataForSEOCredentials {
  const config = useRuntimeConfig()
  return {
    login: config.dataforseo?.login || '',
    password: config.dataforseo?.password || '',
  }
}

function getAuthHeader(credentials = getCredentials()): string {
  const { login, password } = credentials
  return `Basic ${btoa(`${login}:${password}`)}`
}

/**
 * One POST to a live endpoint: transport + spend record. Every call to the
 * shared account goes through here, so every batch lands in the
 * `dataforseo_requests` ledger with the provider's measured cost. The meter is
 * best-effort and never fails the call: the budget GATE runs at the route seam
 * before the provider is reached.
 *
 * A provider outage is classified here rather than at each route, so no tool
 * route can forget it: `/api/tools/bulk-check` and `/api/tools/site-report`
 * both used to leak the raw `FetchError` as a 500 and file it in Sentry.
 */
async function dataforseoFetch<T>(endpoint: string, body: Record<string, unknown>[], ctx?: DataForSeoCallContext): Promise<T> {
  const providerBody = tagDataForSeoTasks(body, ctx?.tool ?? 'internal', crypto.randomUUID())
  const providerFetch = ctx?.providerFetch ?? $fetch
  try {
    const data = await providerFetch<DataForSeoResponse<T>>(`https://api.dataforseo.com/v3${endpoint}`, {
      ...DATAFORSEO_RETRY_OPTIONS,
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(ctx?.credentials),
        'Content-Type': 'application/json',
      },
      body: providerBody,
    })
    if (ctx?.tool) {
      // `cost` is USD for the tasks this response actually served.
      void recordDataForSeoSpend(
        { tool: ctx.tool, endpoint, taskCount: body.length },
        { httpStatus: 200, costUsdMicros: typeof data.cost === 'number' ? Math.round(data.cost * 1e6) : null },
        ctx,
      )
    }
    return data as T
  }
  catch (err) {
    const httpStatus = dataForSeoStatusCode(err) ?? 0
    if (ctx?.tool) {
      // Failed transport: no body, provider charges nothing, but the attempt
      // is still evidence — a 402 storm here is how the account running dry
      // was first noticed.
      void recordDataForSeoSpend(
        { tool: ctx.tool, endpoint, taskCount: body.length },
        { httpStatus, costUsdMicros: null },
        ctx,
      )
    }
    if (isTransientDataForSeoFailure(err))
      throw createError({ statusCode: 503, message: DATAFORSEO_UNAVAILABLE_MESSAGE, cause: err })
    throw err
  }
}

export async function checkUrlIndexed(url: string, ctx?: DataForSeoCallContext): Promise<IndexCheckResult> {
  const data = await dataforseoFetch<DataForSeoResponse<SerpTaskResult>>('/serp/google/organic/live/advanced', [
    {
      keyword: `site:${url}`,
      location_code: 2840, // US
      language_code: 'en',
      depth: 10,
    },
  ], ctx)

  return matchSiteSearch(url, data?.tasks?.[0]?.result?.[0])
}

/**
 * Live SERP calls one bulk run keeps open at once. A Worker holds at most six
 * connections that wait for response headers, and each call also starts its
 * spend ledger writes, so three leaves room for them.
 */
const BULK_CHECK_CONCURRENCY = 3

/**
 * One row of a bulk run. `NotChecked` means the provider stayed down for that
 * URL after its retries, so the row has no verdict.
 */
export type BulkCheckRow
  = | ({ _tag: 'Checked' } & IndexCheckResult)
    | { _tag: 'NotChecked', url: string }

/**
 * Check each URL with its own `site:` search. DataForSEO documents that "each
 * Live SERP API call can contain only one task". A batched call was billed like
 * one check, so the other URLs in a bulk run got a verdict no search backed.
 *
 * A provider outage for one URL becomes a `NotChecked` row and the other rows
 * keep their verdicts. An outage for every URL is the 503 a single check
 * gives. Any other failure, such as a credential error, fails the run and stops
 * new calls.
 */
export async function checkUrlsIndexed(urls: string[], ctx?: DataForSeoCallContext): Promise<BulkCheckRow[]> {
  const rows: BulkCheckRow[] = []
  const failures: unknown[] = []
  let next = 0

  async function worker(): Promise<void> {
    while (failures.length === 0 && next < urls.length) {
      const index = next++
      const url = urls[index]!
      await checkUrlIndexed(url, ctx).then(
        (result) => {
          rows[index] = { _tag: 'Checked', ...result }
        },
        (error: unknown) => {
          if (isTransientDataForSeoFailure(error))
            rows[index] = { _tag: 'NotChecked', url }
          else
            failures.push(error)
        },
      )
    }
  }

  // Every worker settles before the run answers, so no provider call outlives the request.
  await Promise.all(Array.from({ length: Math.min(BULK_CHECK_CONCURRENCY, urls.length) }, worker))

  if (failures.length > 0)
    throw failures[0]
  if (rows.length > 0 && rows.every(row => row._tag === 'NotChecked'))
    throw createError({ statusCode: 503, message: DATAFORSEO_UNAVAILABLE_MESSAGE })
  return rows
}

export async function getDomainOverview(domain: string, ctx?: DataForSeoCallContext): Promise<DomainOverviewResult> {
  // Get estimated indexed pages via site: query
  const siteData = await dataforseoFetch<DataForSeoResponse<SerpTaskResult>>('/serp/google/organic/live/advanced', [
    {
      keyword: `site:${domain}`,
      location_code: 2840,
      language_code: 'en',
      depth: 100,
    },
  ], ctx)

  const siteResult = siteData?.tasks?.[0]?.result?.[0]
  const estimatedIndexedPages = siteResult?.total || 0
  const topOrganicPages = (siteResult?.items || [])
    .filter(item => item.type === 'organic')
    .slice(0, 10)
    .map(item => ({
      url: item.url,
      traffic: 0, // SERP data doesn't have traffic, but we show the URL
      keywords: 0,
    }))

  // Get domain metrics via ranked keywords
  let organicTraffic = 0
  let organicKeywords = 0

  try {
    const domainData = await dataforseoFetch<DataForSeoResponse<DomainRankResult>>('/dataforseo_labs/google/domain_rank_overview/live', [
      {
        target: domain,
        location_code: 2840,
        language_code: 'en',
      },
    ], ctx)

    const domainResult = domainData?.tasks?.[0]?.result?.[0]?.items?.[0]
    if (domainResult) {
      organicTraffic = domainResult.metrics?.organic?.etv || 0
      organicKeywords = domainResult.metrics?.organic?.count || 0
    }
  }
  catch {
    // Domain rank overview may not be available for all domains
  }

  return {
    domain,
    organicTraffic: Math.round(organicTraffic),
    organicKeywords,
    estimatedIndexedPages,
    topPages: topOrganicPages,
  }
}

export async function fetchSitemapUrlsFromXml(sitemapUrl: string): Promise<string[]> {
  const response = await $fetch<string>(sitemapUrl, { responseType: 'text' })
  const urls: string[] = []
  const extractLocations = (xml: string) => Array.from(
    xml.matchAll(/<loc>([^<]*)<\/loc>/g),
    match => match[1]?.trim(),
  ).filter((location): location is string => Boolean(location))

  if (response.includes('<sitemapindex')) {
    const childUrls = extractLocations(response)

    for (const childUrl of childUrls.slice(0, 5)) {
      const childResponse = await $fetch<string>(childUrl, { responseType: 'text' }).catch(() => '')
      urls.push(...extractLocations(childResponse))
    }
  }
  else {
    urls.push(...extractLocations(response))
  }

  return urls
}
