import type { GscdumpIndexingUrl } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexCohortFilter, IndexCohortsResponse } from './contracts/index-cohorts'
import type { IndexCohortPage } from './index-cohorts'
import { belongsToIndexCohort, buildIndexCohortDiagnosis, COHORT_MIN_ENUMERATED_SHARE } from './index-cohorts'

// Which part of this site does Google treat worse than the rest?
//
// nuxtseo.com answers this by joining its own crawl read-model against the
// inspection set. request-indexing runs no crawler, so the partition is built
// from the URL Inspection rows alone: every inspected URL carries a path and a
// verdict, which is all `buildIndexCohortDiagnosis` needs. `notCrawled` is
// therefore always 0 here, and the wire contract stays identical so the shared
// cohort list and lead selector render unchanged.
//
// The list can hold far fewer not-indexed URLs than gscdump reports for the
// Site. A rate built on it would then treat every unlisted URL as absent, so
// below `COHORT_MIN_ENUMERATED_SHARE` the builder refuses with
// `sampled-index-state` rather than rank sections (nuxtseo.com #1306).
//
// Pure data in, data out. The endpoint owns the fetch; this owns the decision.

export interface IndexCohortSource {
  urls: ReadonlyArray<Pick<GscdumpIndexingUrl, 'url' | 'verdict' | 'sitemaps'>>
  /** The site URL the inspection set belongs to, used to resolve relative rows. */
  siteUrl?: string | null
  /**
   * The not-indexed count gscdump reports for the Site: the diagnostics
   * `not_indexed` issue. 0 when the bucket is absent, because diagnostics
   * lists only non-zero buckets.
   */
  reportedNotIndexed: number
}

/**
 * A URL Inspection row becomes a cohort page when it parses to an http(s) URL
 * with no fragment. A `#anchor` URL can never be indexed on its own, so it is
 * counted as excluded rather than folded into a section rate it would distort.
 */
type ParsedRow
  = | { _tag: 'page', page: IndexCohortPage, href: string }
    | { _tag: 'fragment' }
    | { _tag: 'unparsable' }

function parseRow(row: IndexCohortSource['urls'][number], base?: string | null): ParsedRow {
  const candidate = row.url?.trim()
  if (!candidate)
    return { _tag: 'unparsable' }

  let parsed: URL
  try {
    // Absolute rows do not depend on optional site metadata.
    parsed = new URL(candidate)
  }
  catch {
    const site = base?.trim()
    const origin = site?.startsWith('sc-domain:')
      ? `https://${site.slice('sc-domain:'.length)}`
      : site && !site.includes('://')
        ? `https://${site}`
        : site
    try {
      parsed = new URL(candidate, origin)
    }
    catch {
      return { _tag: 'unparsable' }
    }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    return { _tag: 'unparsable' }
  if (parsed.hash)
    return { _tag: 'fragment' }

  return {
    _tag: 'page',
    href: parsed.href,
    page: {
      path: parsed.pathname,
      indexed: row.verdict === 'PASS',
      inSitemap: Array.isArray(row.sitemaps) ? row.sitemaps.length > 0 : false,
    },
  }
}

/**
 * Build the wire response from a complete inspection snapshot.
 *
 * `asOf` is the caller's snapshot timestamp, not a crawl date, and
 * `crawlSettingsId` is always null: request-indexing has no crawl settings to
 * point at. Both fields stay on the wire because the shared contract is the
 * same one nuxtseo.com publishes.
 */
export function buildIndexCohortsFromIndexingUrls(
  source: IndexCohortSource,
  asOf: string | null = null,
): IndexCohortsResponse {
  const pages: IndexCohortPage[] = []
  const notIndexedUrls = new Set<string>()
  let excludedFragments = 0

  for (const row of source.urls) {
    const parsed = parseRow(row, source.siteUrl)
    if (parsed._tag === 'page') {
      pages.push(parsed.page)
      if (!parsed.page.indexed)
        notIndexedUrls.add(parsed.href)
    }
    else if (parsed._tag === 'fragment') {
      excludedFragments += 1
    }
  }

  const enumerated = notIndexedUrls.size
  const reported = source.reportedNotIndexed
  if (reported > 0 && enumerated / reported < COHORT_MIN_ENUMERATED_SHARE) {
    return {
      _tag: 'no-evidence',
      crawlSettingsId: null,
      asOf,
      reason: 'sampled-index-state',
      sample: { enumerated, reported },
    }
  }

  const diagnosis = buildIndexCohortDiagnosis({
    pages,
    excludedFragments,
    // No crawler, so every inspected URL that parsed was analysed.
    notCrawled: 0,
  })

  if (diagnosis._tag === 'no-evidence')
    return { _tag: 'no-evidence', crawlSettingsId: null, asOf, reason: diagnosis.reason, sample: null }

  if (diagnosis._tag === 'uniform') {
    return {
      _tag: 'uniform',
      crawlSettingsId: null,
      asOf,
      baseline: diagnosis.baseline,
      coverage: diagnosis.coverage,
      z: diagnosis.z,
      tested: diagnosis.tested,
    }
  }

  return {
    _tag: 'outliers',
    crawlSettingsId: null,
    asOf,
    baseline: diagnosis.baseline,
    coverage: diagnosis.coverage,
    z: diagnosis.z,
    tested: diagnosis.tested,
    cells: diagnosis.cells,
  }
}

export function selectIndexCohortUrls<Url extends IndexCohortSource['urls'][number]>(
  urls: ReadonlyArray<Url>,
  filter: IndexCohortFilter,
  siteUrl?: string | null,
): Url[] {
  return urls.filter((row) => {
    const parsed = parseRow(row, siteUrl)
    return parsed._tag === 'page' && !parsed.page.indexed && belongsToIndexCohort(parsed.page.path, filter)
  })
}
