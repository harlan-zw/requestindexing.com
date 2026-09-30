// The pure core of the fleet Search Indexing page: one gscdump
// `partner.sites.indexing.get` read per Site in, the per-Site and all-sites
// figures out. Ported from the derivations inside nuxtseo.com's
// `ProSiteGroupIndexing.vue` and the ingestion step in its
// `useDashboardSiteData.ts`, lifted out of the component so they can be tested.
import type { GscdumpIndexingResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { SiteIndexingTrendIssuePoint } from '#layers/pro-indexing/shared/site-indexing-issues'
import { calcTrendPercent } from '#layers/design-system/app/composables/formatting'

export interface FleetIndexingSummary {
  indexed: number
  totalUrls: number
  indexedPercent: number
  change7d: number | null
  change28d: number | null
}

export interface FleetIndexingTrendPoint extends SiteIndexingTrendIssuePoint {
  date: string
  indexedPercent: number
  indexedCount: number
}

export interface FleetIndexingData {
  summary: FleetIndexingSummary
  trend: FleetIndexingTrendPoint[]
}

/**
 * Where one Site's indexing read stands.
 *
 * `NotConnected` is decided from the Site row, never from a fetch: a Site
 * without a gscdump id has nothing to ask the engine for.
 */
export type SiteIndexingRead
  = | { _tag: 'NotConnected' }
    | { _tag: 'Loading' }
    | { _tag: 'Failed' }
    | { _tag: 'Loaded', data: FleetIndexingData }

export interface FleetIndexingAggregate {
  indexed: number
  total: number
  percent: number
}

export interface FleetIndexingAggregatePoint {
  date: string
  indexedPercent: number
  indexedCount: number
  errors: number
}

/**
 * Index rate is "% of inspected URLs indexed", so it caps at 100%. When the
 * denominator collapses upstream (a sitemap sync drops URLs) the gscdump figure
 * can pass 100% (nuxtseo.com users saw over 1700% on one day). Clamp once, at
 * ingestion, so every figure downstream stays bounded.
 */
export function clampRate(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function orUndefined(value: number | null | undefined): number | undefined {
  return value ?? undefined
}

/** Parse one engine response into the fields this page reads. */
export function readSiteIndexing(response: GscdumpIndexingResponse): FleetIndexingData {
  const { summary } = response
  return {
    summary: {
      indexed: summary.indexed,
      totalUrls: summary.totalUrls,
      indexedPercent: clampRate(summary.indexedPercent),
      change7d: summary.change7d,
      change28d: summary.change28d,
    },
    trend: response.trend.map(point => ({
      date: point.date,
      indexedPercent: clampRate(point.indexedPercent),
      indexedCount: point.indexedCount ?? 0,
      issues: {
        notFound: orUndefined(point.issues.notFound),
        soft404: orUndefined(point.issues.soft404),
        serverError: orUndefined(point.issues.serverError),
        blockedByRobots: orUndefined(point.issues.blockedByRobots),
      },
      // The coverage decisions are the reasons behind unindexed URLs on a Site
      // with no crawl errors. Dropping them left those Sites with an empty
      // issue breakdown upstream.
      coverage: {
        crawledNotIndexed: orUndefined(point.coverage?.crawledNotIndexed),
        discoveredNotCrawled: orUndefined(point.coverage?.discoveredNotCrawled),
      },
      signals: {
        richResultsFail: orUndefined(point.signals.richResultsFail),
      },
    })),
  }
}

/** The loaded data, only when Search Console has reported at least one URL. */
export function observedIndexing(read: SiteIndexingRead): FleetIndexingData | null {
  return read._tag === 'Loaded' && read.data.summary.totalUrls > 0 ? read.data : null
}

/** Crawl errors on one trend point: not found, soft 404 and server errors. */
export function sumErrors(issues: FleetIndexingTrendPoint['issues']): number {
  return (issues?.notFound ?? 0) + (issues?.soft404 ?? 0) + (issues?.serverError ?? 0)
}

/** Crawl errors on the most recent trend point. */
export function latestErrors(read: SiteIndexingRead): number {
  const point = read._tag === 'Loaded' ? read.data.trend.at(-1) : undefined
  return point ? sumErrors(point.issues) : 0
}

/**
 * URLs at stake for a Site: inspected minus indexed. The table ranks on this,
 * because a rate is not comparable across denominators: 19% of 16 URLs (13
 * missing) read as the worst Site next to 83% of 373 (63 missing). Null when
 * the Site has no observation.
 */
export function unindexedCount(read: SiteIndexingRead): number | null {
  const data = observedIndexing(read)
  return data ? Math.max(0, data.summary.totalUrls - data.summary.indexed) : null
}

export type RateHealth = 'ok' | 'warning' | 'error'

/**
 * A passing rate is a non-event and renders as a plain numeral. Only failing
 * rates take a hue, and the hue must agree with the number.
 */
export function rateHealth(percent: number): RateHealth {
  if (percent >= 80)
    return 'ok'
  return percent >= 50 ? 'warning' : 'error'
}

/**
 * Fill width for the Not indexed cell. A healthy Site draws nothing. An
 * unhealthy one fills to the share of its URLs that are missing, so the bar,
 * the numeral and its hue say the same thing and none scales against the
 * biggest Site.
 */
export function unindexedBarPercent(percent: number): number {
  return rateHealth(percent) === 'ok' ? 0 : Math.min(100, Math.max(0, 100 - percent))
}

/** Indexed and inspected URLs summed over every Site with an observation. */
export function aggregateIndexed(reads: Iterable<SiteIndexingRead>): FleetIndexingAggregate | null {
  let indexed = 0
  let total = 0
  let hasAny = false
  for (const read of reads) {
    const data = observedIndexing(read)
    if (!data)
      continue
    indexed += data.summary.indexed
    total += data.summary.totalUrls
    hasAny = true
  }
  return hasAny ? { indexed, total, percent: total > 0 ? (indexed / total) * 100 : 0 } : null
}

/**
 * One point per day across every observed Site: the mean index rate, and the
 * summed indexed URLs and crawl errors. Upstream averages the rate rather than
 * weighting it, so a small Site moves the line as much as a large one.
 */
export function aggregateIndexingTrend(reads: Iterable<SiteIndexingRead>): FleetIndexingAggregatePoint[] {
  const byDate = new Map<string, { rates: number[], indexedCount: number, errors: number }>()
  for (const read of reads) {
    const data = observedIndexing(read)
    if (!data)
      continue
    for (const point of data.trend) {
      const day = byDate.get(point.date) ?? { rates: [], indexedCount: 0, errors: 0 }
      day.rates.push(point.indexedPercent)
      day.indexedCount += point.indexedCount
      day.errors += sumErrors(point.issues)
      byDate.set(point.date, day)
    }
  }
  return Array.from(byDate, ([date, day]) => ({
    date,
    indexedPercent: day.rates.reduce((sum, rate) => sum + rate, 0) / day.rates.length,
    indexedCount: day.indexedCount,
    errors: day.errors,
  }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Relative change of the index rate from the first to the last point. A
 * relative change off a near-zero rate explodes (0.5% to 50% reads as +9900%),
 * so below a 1% starting rate there is no trend to show.
 */
export function indexedRateChange(trend: ReadonlyArray<{ indexedPercent: number }>): number | null {
  if (trend.length < 2)
    return null
  const first = trend[0]!.indexedPercent
  const last = trend.at(-1)!.indexedPercent
  if (first < 1)
    return null
  return calcTrendPercent(last, first)
}

/** Relative change from the first to the last value of a count series. */
export function seriesChange(values: readonly number[]): number | null {
  if (values.length < 2)
    return null
  const first = values[0]
  const last = values.at(-1)
  if (!first || last == null)
    return null
  return calcTrendPercent(last, first)
}

/** This Site's share of every indexed URL on the page, as a whole percent. */
export function indexedShare(read: SiteIndexingRead, aggregate: FleetIndexingAggregate | null): number | null {
  const indexed = observedIndexing(read)?.summary.indexed
  if (!indexed || !aggregate?.indexed)
    return null
  return Math.round((indexed / aggregate.indexed) * 100)
}

/**
 * The resting order of the By site table: most URLs at stake first, Sites with
 * no observation last. The table is a worklist, so a 13-URL Site must not sit
 * above a 63-URL one.
 */
export function compareByUnindexed(a: SiteIndexingRead, b: SiteIndexingRead): number {
  const av = unindexedCount(a)
  const bv = unindexedCount(b)
  if (av === bv)
    return 0
  if (av == null)
    return 1
  if (bv == null)
    return -1
  return bv - av
}
