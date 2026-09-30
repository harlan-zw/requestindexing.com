// Cohort comparison for "why won't Google index my site?".
//
// Google does not decline pages at random, it declines them for structural
// reasons that live in OUR crawl data rather than in GSC's taxonomy. Relaying
// GSC's own buckets ("37 crawled but not indexed") names a symptom and sends the
// developer to ChatGPT; partitioning the crawled+inspected set and asking which
// partition Google treats differently names something they can act on.
//
// The load-bearing part is the REFUTATION, not the clustering. During design,
// every compelling single-variable cluster collapsed under a controlled test:
//   - `/learn-seo/vue` looked like duplicate suppression at 23.4% vs a 14.8%
//     site rate, but 26 of its 36 near-identical `/learn-seo/nuxt` mirror pairs
//     have BOTH members indexed.
//   - "orphaned from nav" looked causal until the internal-link effect INVERTED
//     between legacy and current docs in the same section.
// So a cohort is surfaced only when its Wilson score interval clears the rate of
// its own complement — never on a point estimate. Cohorts are compared against
// the complement rather than the site-wide rate because a cohort that dominates
// the site would otherwise be validated against a baseline containing itself.
//
// Deliberately NOT dimensions: crawl depth and internal-link bands. Both failed
// the controlled test above, and every extra dimension inflates the
// multiple-comparison correction, making true findings harder to surface. They
// go back in when there is evidence, not before.

export interface IndexCohortPage {
  /** Site-relative path, e.g. `/docs/og-image/v5/guides/emojis`. */
  path: string
  /** Google currently reports this URL as indexed. */
  indexed: boolean
  inSitemap: boolean
}

export type IndexCohortDimension = 'section' | 'lifecycle'

export interface IndexCohortCell {
  dimension: IndexCohortDimension
  /** Stable identifier — a path prefix for `section`, a lifecycle tag otherwise. */
  key: string
  label: string
  /**
   * Path prefix that isolates this cohort in the URL list, or null when the
   * cohort is not expressible as one (a lifecycle cohort spans many prefixes).
   * Null means the drill-through must fall back to the unfiltered not-indexed
   * list rather than apply a filter that only approximates the cohort.
   */
  pathPrefix: string | null
  total: number
  notIndexed: number
  /** Not-indexed share within the cohort. */
  rate: number
  /** Not-indexed share across every analysed page OUTSIDE this cohort. */
  complementRate: number
  complementTotal: number
  ciLower: number
  ciUpper: number
  /**
   * How many of this cohort's not-indexed pages are already counted by a
   * higher-ranked cohort. Cohorts come from independent partitions and can nest
   * (a version subtree sits inside its section), so without this a reader adds
   * 13 and 21 and believes 34 pages are affected when 21 are.
   */
  overlapNotIndexed: number
}

export interface IndexCohortCoverage {
  /** Pages that joined both the crawl and the inspection set — the denominator. */
  analysed: number
  /** Inspected URLs dropped as `#fragment` anchors; they can never be indexed. */
  excludedFragments: number
  /** Inspected URLs our crawler never reached, so they carry no cohort attributes. */
  notCrawled: number
}

/**
 * The enumerated not-indexed list must cover at least this share of the count
 * gscdump reports. Below it the list is a sample and every rate built on it
 * would treat the unlisted URLs as absent. Ported from nuxtseo.com #1306.
 */
export const COHORT_MIN_ENUMERATED_SHARE = 0.9

/** Message for the `sampled-index-state` no-evidence reason, shared by every surface. */
export function sampledIndexStateMessage(enumerated: number, reported: number): string {
  return `Google index state is a sample: ${enumerated.toLocaleString('en-US')} of ${reported.toLocaleString('en-US')} not-indexed URLs. Family rates would be invented. Read the indexing summary instead.`
}

export interface IndexCohortBaseline {
  total: number
  notIndexed: number
  rate: number
}

export type IndexCohortDiagnosis
  /**
   * `no-inspection-join` is the only reason the pure builder can produce; the
   * server also reaches this state with `no-completed-crawl` and
   * `sampled-index-state`, which it knows about and the builder cannot. All are
   * real domain states, so the union owns them rather than letting the wire type
   * drift wider than the domain.
   *
   * `sampled-index-state`: the not-indexed list covers under
   * `COHORT_MIN_ENUMERATED_SHARE` of the count gscdump reports. A URL outside
   * the list has an unknown state, so no rate can be computed. `enumerated` and
   * `reported` are the two counts.
   */
  = | { _tag: 'no-evidence', reason: 'no-inspection-join' | 'no-completed-crawl' }
    | { _tag: 'no-evidence', reason: 'sampled-index-state', enumerated: number, reported: number }
    | {
      _tag: 'uniform'
      baseline: IndexCohortBaseline
      coverage: IndexCohortCoverage
      /** Corrected critical value actually applied. */
      z: number
      tested: number
    }
    | {
      _tag: 'outliers'
      baseline: IndexCohortBaseline
      coverage: IndexCohortCoverage
      z: number
      tested: number
      /** Worst-first. Only cohorts Google treats WORSE than their complement. */
      cells: IndexCohortCell[]
    }

/**
 * Below this many pages a cohort's interval is so wide that no honest claim
 * survives it, so testing it only burns multiple-comparison budget.
 */
export const COHORT_MIN_CELL_SIZE = 12

/** Family-wise error rate, split across every cohort tested (Bonferroni). */
const COHORT_FAMILY_ALPHA = 0.05

/**
 * A version-SCOPED subtree: `/v5/` with a path continuing after it. A trailing
 * `/v6` is deliberately excluded — `/docs/robots/releases/v6` is a page ABOUT a
 * version, not a version-pinned copy of the docs, and folding the two together
 * dilutes the cohort with current pages until it can no longer distinguish
 * itself from its complement.
 */
const VERSION_SEGMENT = /\/v\d+\/.+/

/**
 * Wilson score interval for a binomial proportion. Chosen over the normal
 * approximation because cohorts are small and skewed — the normal interval
 * produces bounds outside [0,1] and collapses to zero width at p=0, which would
 * make a 0/20 cohort look certain.
 */
export function wilsonInterval(successes: number, total: number, z: number): { lower: number, upper: number } {
  if (total <= 0)
    return { lower: 0, upper: 1 }
  const p = successes / total
  const z2 = z * z
  const denominator = 1 + z2 / total
  const centre = p + z2 / (2 * total)
  const spread = z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total))
  return {
    lower: Math.max(0, (centre - spread) / denominator),
    upper: Math.min(1, (centre + spread) / denominator),
  }
}

/**
 * Standard-normal quantile (Acklam's rational approximation, |error| < 1.15e-9).
 * Needed because the Bonferroni-corrected alpha varies with cohort count, so the
 * critical value cannot be a hardcoded 1.96.
 */
function normalQuantile(p: number): number {
  if (p <= 0)
    return Number.NEGATIVE_INFINITY
  if (p >= 1)
    return Number.POSITIVE_INFINITY

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q
    / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
}

/** Two-sided critical value for `tested` simultaneous comparisons. */
function criticalValue(tested: number): number {
  const alpha = COHORT_FAMILY_ALPHA / Math.max(1, tested)
  return Math.abs(normalQuantile(alpha / 2))
}

/**
 * Section keys at BOTH depth 1 and depth 2.
 *
 * A fixed depth is wrong for half the fleet: on a flat site (`/whats-on/<slug>`)
 * depth 2 shatters into one page per key and finds nothing — mdream.dev showed
 * 409 distinct two-segment keys across 410 pages — while on a deep docs site
 * depth 1 collapses every page under `/docs` into a single uninformative cell.
 * Emitting both and letting the min-cell-size and significance tests decide
 * costs some multiple-comparison budget and covers both shapes. Nesting between
 * the two depths is what `overlapNotIndexed` already accounts for.
 */
function sectionKeys(path: string): string[] {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0)
    return ['/']
  const depth1 = `/${segments[0]}`
  if (segments.length === 1)
    return [depth1]
  return [depth1, `/${segments.slice(0, 2).join('/')}`]
}

/**
 * `versioned` covers docs carrying an explicit version segment. We label it
 * `versioned` rather than `superseded` on purpose: without knowing a site's
 * current version we cannot prove supersession, only that the path is pinned.
 */
function lifecycleKey(path: string): 'versioned' | 'evergreen' {
  return VERSION_SEGMENT.test(path) ? 'versioned' : 'evergreen'
}

const LIFECYCLE_LABEL: Record<'versioned' | 'evergreen', string> = {
  versioned: 'Version-pinned paths',
  evergreen: 'Unversioned paths',
}

interface Tally { total: number, notIndexed: number, notIndexedPaths: string[] }

/** A page may belong to several cells of one dimension (nested section depths). */
function tally(pages: ReadonlyArray<IndexCohortPage>, keysOf: (page: IndexCohortPage) => string[]): Map<string, Tally> {
  const out = new Map<string, Tally>()
  for (const page of pages) {
    for (const key of keysOf(page)) {
      const current = out.get(key) ?? { total: 0, notIndexed: 0, notIndexedPaths: [] }
      current.total += 1
      if (!page.indexed) {
        current.notIndexed += 1
        current.notIndexedPaths.push(page.path)
      }
      out.set(key, current)
    }
  }
  return out
}

export interface BuildIndexCohortInput {
  pages: ReadonlyArray<IndexCohortPage>
  excludedFragments: number
  notCrawled: number
}

/**
 * Partition the analysed pages and return only the cohorts Google demonstrably
 * treats worse than the rest of the site.
 */
export function buildIndexCohortDiagnosis(input: BuildIndexCohortInput): IndexCohortDiagnosis {
  const { pages, excludedFragments, notCrawled } = input
  if (pages.length === 0)
    return { _tag: 'no-evidence', reason: 'no-inspection-join' }

  const notIndexed = pages.reduce((sum, page) => sum + (page.indexed ? 0 : 1), 0)
  const baseline: IndexCohortBaseline = {
    total: pages.length,
    notIndexed,
    rate: notIndexed / pages.length,
  }
  const coverage: IndexCohortCoverage = {
    analysed: pages.length,
    excludedFragments,
    notCrawled,
  }

  const dimensions: ReadonlyArray<{
    dimension: IndexCohortDimension
    tallies: Map<string, Tally>
    label: (key: string) => string
  }> = [
    { dimension: 'section', tallies: tally(pages, page => sectionKeys(page.path)), label: key => key },
    {
      dimension: 'lifecycle',
      tallies: tally(pages, page => [lifecycleKey(page.path)]),
      label: key => LIFECYCLE_LABEL[key as 'versioned' | 'evergreen'] ?? key,
    },
  ]

  // Count every cell that will be tested BEFORE testing any of them — the
  // correction has to reflect how many chances the detector gave itself.
  const candidates = dimensions.flatMap(({ dimension, tallies, label }) =>
    [...tallies.entries()]
      .filter(([, cell]) => cell.total >= COHORT_MIN_CELL_SIZE && cell.total < pages.length)
      .map(([key, cell]) => ({ dimension, key, label: label(key), cell })),
  )

  const tested = candidates.length
  const z = criticalValue(tested)
  if (tested === 0)
    return { _tag: 'uniform', baseline, coverage, z, tested }

  const survivors: Array<{ cell: IndexCohortCell, notIndexedPaths: string[] }> = []
  for (const { dimension, key, label, cell } of candidates) {
    const complementTotal = baseline.total - cell.total
    const complementNotIndexed = baseline.notIndexed - cell.notIndexed
    const complementRate = complementTotal > 0 ? complementNotIndexed / complementTotal : 0
    const { lower, upper } = wilsonInterval(cell.notIndexed, cell.total, z)

    // The complement is the CONTROL, so it needs to be a usable one. A cohort
    // holding 399 of 410 pages leaves an 11-page complement whose rate is a
    // coin-flip, and testing a tight cohort interval against that point estimate
    // manufactures findings out of noise (mdream.dev, 2026-07-25).
    if (complementTotal < COHORT_MIN_CELL_SIZE)
      continue

    // Only WORSE cohorts. A section Google indexes better than the rest of the
    // site is not a diagnosis and has no next action.
    if (lower <= complementRate)
      continue

    survivors.push({
      notIndexedPaths: cell.notIndexedPaths,
      cell: {
        dimension,
        key,
        label,
        pathPrefix: dimension === 'section' ? key : null,
        total: cell.total,
        notIndexed: cell.notIndexed,
        rate: cell.notIndexed / cell.total,
        complementRate,
        complementTotal,
        ciLower: lower,
        ciUpper: upper,
        overlapNotIndexed: 0,
      },
    })
  }

  if (survivors.length === 0)
    return { _tag: 'uniform', baseline, coverage, z, tested }

  survivors.sort((left, right) =>
    (right.cell.rate - right.cell.complementRate) - (left.cell.rate - left.cell.complementRate)
    || right.cell.notIndexed - left.cell.notIndexed,
  )

  // Attribute each not-indexed page to the first (worst) cohort that claims it,
  // so the ranked list can be read top-down without double-counting.
  const claimed = new Set<string>()
  const cells = survivors.map(({ cell, notIndexedPaths }) => {
    const overlapNotIndexed = notIndexedPaths.reduce((sum, path) => sum + (claimed.has(path) ? 1 : 0), 0)
    for (const path of notIndexedPaths)
      claimed.add(path)
    return { ...cell, overlapNotIndexed }
  })

  return { _tag: 'outliers', baseline, coverage, z, tested, cells }
}

/**
 * One route family's raw not-indexed tally, with NO significance test applied.
 *
 * `established` is the whole point of the shape. `buildIndexCohortDiagnosis`
 * answers "prove this family is worse than the rest of the site" and correctly
 * says nothing when nothing clears Bonferroni — but an agent asking "where is my
 * indexing worst?" needs an answer even then, and the honest answer is a ranking,
 * not a finding. Carrying the flag ON EVERY ROW means a consumer cannot render
 * the ranking without also rendering which rows are proven, so an untested rate
 * can never be relayed as an established one.
 */
export interface IndexCohortSectionRank {
  /** Path prefix at depth 1 or 2 — the same keys the tested cohorts use. */
  key: string
  total: number
  notIndexed: number
  /** Not-indexed share within the section. A POINT ESTIMATE, not a verdict. */
  rate: number
  /** This section also cleared the corrected significance test in the same run. */
  established: boolean
  /** Too few pages for any test to have been attempted (`COHORT_MIN_CELL_SIZE`). */
  belowMinimumSample: boolean
}

/**
 * Every section key ranked by not-indexed rate, worst first.
 *
 * Deliberately unfiltered by significance: this is the descriptive half of the
 * pair, and its rows are only safe to publish next to the tested half that says
 * which of them survived. Sections spanning the whole analysed set are dropped
 * for the same reason `buildIndexCohortDiagnosis` refuses to test them — a
 * "family" containing every page cannot be worse than its own complement.
 */
export function rankIndexCohortSections(
  pages: ReadonlyArray<IndexCohortPage>,
  established: ReadonlyArray<IndexCohortCell> = [],
): IndexCohortSectionRank[] {
  const establishedKeys = new Set(
    established.filter(cell => cell.dimension === 'section').map(cell => cell.key),
  )
  return [...tally(pages, page => sectionKeys(page.path)).entries()]
    .filter(([, cell]) => cell.total < pages.length)
    .map(([key, cell]) => ({
      key,
      total: cell.total,
      notIndexed: cell.notIndexed,
      rate: cell.notIndexed / cell.total,
      established: establishedKeys.has(key),
      belowMinimumSample: cell.total < COHORT_MIN_CELL_SIZE,
    }))
    .sort((left, right) =>
      right.rate - left.rate
      || right.notIndexed - left.notIndexed
      || left.key.localeCompare(right.key),
    )
}

/**
 * The hero lead derived from a cohort diagnosis.
 *
 * `none` carries WHY there is no lead so the caller cannot mistake "the
 * detector found nothing" for "the detector did not run".
 */
export type IndexCohortLead
  = | { _tag: 'none', reason: 'no-evidence' | 'no-outlier' }
    | {
      _tag: 'lead'
      /** Headline: the noun and the number, stating what is. */
      title: string
      /** The comparison that makes the headline a diagnosis rather than a count. */
      detail: string
      actionLabel: string
      cell: IndexCohortCell
    }

/** Reads naturally after a count: "21 of 76 <subject> are missing…". */
function cohortSubject(cell: IndexCohortCell): string {
  return cell.dimension === 'section'
    ? `pages under ${cell.key}`
    : 'version-pinned pages'
}

const asPercent = (value: number) => `${Math.round(value * 100)}%`

/**
 * Promote the worst cohort to the page's primary diagnosis.
 *
 * A located claim ("21 of 76 pages under /docs/og-image are missing from
 * Google's index") is strictly more actionable than the reason-derived headline
 * it replaces ("Google crawled 38 URLs but chose not to keep them"), which names
 * a symptom and sends the reader elsewhere to interpret it. When no cohort
 * separates, the reason-led headline remains correct and stays.
 */
export function selectIndexCohortLead(diagnosis: { _tag: 'no-evidence' } | Exclude<IndexCohortDiagnosis, { _tag: 'no-evidence' }>): IndexCohortLead {
  if (diagnosis._tag === 'no-evidence')
    return { _tag: 'none', reason: 'no-evidence' }
  if (diagnosis._tag === 'uniform')
    return { _tag: 'none', reason: 'no-outlier' }

  const cell = diagnosis.cells[0]
  if (!cell)
    return { _tag: 'none', reason: 'no-outlier' }

  return {
    _tag: 'lead',
    title: `${cell.notIndexed.toLocaleString()} of ${cell.total.toLocaleString()} ${cohortSubject(cell)} are missing from Google's index.`,
    detail: `That is ${asPercent(cell.rate)} not indexed, against ${asPercent(cell.complementRate)} across the rest of the site.`,
    actionLabel: `Review these ${cell.notIndexed.toLocaleString()} URLs`,
    cell,
  }
}
