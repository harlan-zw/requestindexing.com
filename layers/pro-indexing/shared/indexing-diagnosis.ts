import type { ClassifySearchConsoleStageInput, SearchConsoleStageIssue, SearchConsoleStageKey } from '@gscdump/sdk/search-console-stage'
import type { SiteTriage } from '@gscdump/sdk/site-triage'
import type { CrawlRecencyHistogram } from './crawl-recency'
import type { QualityBudget } from './quality-budget'
import { parseCoverageState } from 'gscdump'
import { buildCrawlRecencyHistogram } from './crawl-recency'

const DISCOVERY_WELL_LINKED_SHARE = 0.5

/** Chrome only counts as a "thin relative to length" signal once it passes half the page. */
const CHROME_DOMINATES_PCT = 50

export type IndexingDiagnosisReason
  = | 'none'
    | 'crawl_blocked'
    | 'canonical_or_indexability_blocked'
    | 'unknown_to_google_discovery_gap'
    | 'discovered_not_crawled'
    | 'crawled_not_indexed_quality_selection'
    | 'not_indexed_unspecified'
    | 'mixed_indexing_failure'
    | 'data_incomplete'

export type IndexingDiagnosisConfidence = 'high' | 'medium' | 'low'
export type IndexingDiagnosisSeverity = 'ok' | 'watch' | 'severe'

export interface IndexingEvidenceUrl {
  url: string
  issueType?: string | null
  verdict?: string | null
  coverageState?: string | null
  indexingState?: string | null
  robotsTxtState?: string | null
  pageFetchState?: string | null
  lastCrawlTime?: string | null
  userCanonical?: string | null
  googleCanonical?: string | null
  sitemaps?: string[] | null
  referringUrls?: string[] | null
  /** Crawl-detected inbound internal link instances pointing at this URL. */
  internalIncomingLinks?: number | null
  /** Distinct crawl-detected source pages linking to this URL. */
  internalIncomingSourcePages?: number | null
  /** Crawl-detected inbound links from main/content areas. */
  internalIncomingContextualLinks?: number | null
  /** Distinct source pages linking from main/content areas. */
  internalIncomingContextualSourcePages?: number | null
  /** Crawl-detected inbound links from template-like areas: header/nav/footer/aside. */
  internalIncomingTemplateLinks?: number | null
  /** Distinct source pages linking from template-like areas. */
  internalIncomingTemplateSourcePages?: number | null
  crawlDepth?: number | null
  isInternalLinkOrphan?: boolean | null
  suggestedInternalLinks?: Array<{
    sourceUrl: string
    sourceTitle?: string | null
    reason?: string | null
  }> | null
}

export interface IndexingDiagnosisInput {
  totalUrls: number | null | undefined
  indexed: number | null | undefined
  issues: SearchConsoleStageIssue[] | null | undefined
  sampleUrls?: IndexingEvidenceUrl[] | null
}

export interface IndexingDiagnosisCounts {
  totalUrls: number
  indexed: number
  notIndexed: number
  indexedPercent: number
  unknownToGoogle: number
  discoveredNotIndexed: number
  crawledNotIndexed: number
  hardBlocks: number
  canonicalMismatches: number
  noindex: number
  genericNotIndexed: number
  /**
   * URLs Google crawled but has not re-fetched in 60+ days (the GSC
   * `very_stale_crawl` reason). Not a not-indexed bucket of its own — a crawl-DEMAND
   * signal: Google has deprioritised re-crawling them, the fingerprint that separates
   * a quality-gated, crawl-starved site from a fresh discovery gap. Surfaced as
   * corroborating evidence, not a headline reason.
   */
  veryStaleCrawl: number
}

export interface IndexingDiagnosisIssueNote {
  type: 'unknown_to_google' | 'discovered_not_indexed' | 'crawled_not_indexed'
  count: number
  confidence: IndexingDiagnosisConfidence
  interpretation: string
  nextEvidence: string[]
}

export interface IndexingDiagnosisAction {
  id:
    | 'complete-indexing-data'
    | 'fix-crawl-access'
    | 'align-indexability-signals'
    | 'improve-discovery'
    | 'strengthen-crawl-priority'
    | 'improve-or-consolidate-content'
    | 'run-url-level-triage'
  title: string
  detail: string
  why: string
  /**
   * Bucket-correct anti-advice (T1.4) — the fix that does NOT work for this bucket,
   * stated so the user doesn't waste a cycle on it. Deterministic, vetted copy only
   * (never model-authored): discovery≠selection means resubmit/IndexNow/internal
   * links can't fix a quality or canonical decision, and a canonical fold is not a
   * content problem. Sourced from the doc §1 "Wrong fix" column.
   */
  antiAdvice?: string
  source: { label: string, url: string }
}

export interface IndexingPrognosis {
  /** Recovery speed band, not a number: fast=days, medium=weeks, slow=a core update away. */
  class: 'fast' | 'medium' | 'slow'
  /**
   * True when re-inclusion realistically waits on a broad Google core update (a
   * quality/selection rejection) rather than a fix the user controls. A
   * coreUpdateGated verdict suppresses "request indexing" advice — resubmitting
   * does not move a quality decision.
   */
  coreUpdateGated: boolean
  /** Deterministic, honest display band. */
  band: string
}

export interface IndexingDiagnosis {
  reason: IndexingDiagnosisReason
  severity: IndexingDiagnosisSeverity
  confidence: IndexingDiagnosisConfidence
  stageKey: SearchConsoleStageKey | null
  summary: string
  primaryAction: string
  counts: IndexingDiagnosisCounts
  evidence: string[]
  ruledOut: string[]
  missingEvidence: string[]
  hiddenRisks: string[]
  issueNotes: IndexingDiagnosisIssueNote[]
  recommendedActions: IndexingDiagnosisAction[]
  sampleUrls: string[]
  /**
   * Recoverability prognosis (T2.3) — composed at the Sprint-context layer via
   * `applyRecoverabilityPrognosis` (this pure function lacks the site age/authority
   * it needs). Absent on the bare diagnosis; present once the caller supplies
   * `isNewSite`.
   */
  prognosis?: IndexingPrognosis
  /**
   * Discovery sub-diagnosis: the dominant reason is a discovery gap, but the unknown
   * URLs are predominantly well-linked internally — Google has a clear path and is
   * still not crawling them. That is crawl demand, not a linking-mechanics gap, so the
   * recovery is core-update-gated (the prognosis reads it). Absent/false when the
   * unknown URLs are orphaned (genuinely linking-fixable) or there is too little link
   * sample to judge.
   */
  discoveryCrawlDemandGated?: boolean
  /**
   * Crawl-recency histogram (T3.1) over the URL-Inspection sample rows' retained
   * `lastCrawlTime` — a stale crawl is a crawl-demand signal. Always sample-size
   * captioned (never a whole-site verdict). Absent when there are no sample rows.
   */
  crawlRecency?: CrawlRecencyHistogram
  /**
   * Crawl-quality budget (T3.3) — earning vs near-duplicate-spending synthesis,
   * composed at the Sprint-context layer (needs the crawl + cluster scorecards).
   * Absent when there is no crawl/cluster signal to synthesise.
   */
  qualityBudget?: QualityBudget
  /**
   * Crawled-not-indexed quality self-check — a deterministic, vetted checklist the
   * owner runs on their OWN pages when the gating bucket is a quality/selection
   * rejection (`coreUpdateGated`). Google crawled the pages and refused to keep
   * them, a call it never explains, so this is the one cause we cannot prove from
   * our side; the engine hands the owner exactly what to audit. Composed where the
   * prognosis is (`applyRecoverabilityPrognosis`); absent for every non-quality
   * bucket. Never model-authored (the why-templates firewall).
   */
  qualitySelfAudit?: QualitySelfAudit
}

/** One self-audit lever the owner checks on their own pages, with the Google source. */
export interface QualitySelfAuditItem {
  id:
    | 'scaled-content'
    | 'thin-relative-to-length'
    | 'templated-at-scale'
    | 'experience-eeat'
    | 'intent-differentiation'
  /** The question to ask, in plain dev/founder English. */
  check: string
  /** Why Google's published guidance cares. */
  why: string
  source: { label: string, url: string }
  /**
   * Per-site evidence for this lever, when the engine measured it from the crawl
   * (T3.6) — e.g. "~80% of rendered words is shared chrome" / "6 pages under
   * /compare/* share a template". Turns the generic check into an evidenced
   * diagnosis. Deterministic, formatted from numbers (never model-authored —
   * the why-templates firewall). Absent when no signal was measured.
   */
  evidence?: string
}

export interface QualitySelfAudit {
  /** Frames why this checklist exists and what clearing it unlocks. */
  intro: string
  items: QualitySelfAuditItem[]
}

/**
 * Per-site signals the Sprint-context layer measures from the crawl and feeds into
 * the self-audit so specific levers carry real evidence (T3.6). All optional — a
 * lever with no measured signal keeps its generic vetted line. The raw numbers are
 * computed where the crawl data + path-pattern util live (the context layer); this
 * shared type only carries the finished numbers so the pure formatter stays
 * dependency-free and the firewall holds (vetted string templates, not free text).
 */
export interface QualitySelfAuditEvidence {
  /**
   * Share of rendered words that is shared chrome (nav/footer/boilerplate) rather
   * than unique main content, measured as full-DOM `word_count` vs extracted-markdown
   * words across the sampled crawled-not-indexed pages. 0–100; with the sample size.
   */
  chrome?: { chromePct: number, sampleSize: number }
  /**
   * Structural template groups: crawled path patterns with ≥ the threshold count of
   * near-structurally-identical pages (e.g. `{ pattern: '/compare/*', count: 6 }`),
   * highest first. Catches the programmatic-template tell even when the prose differs
   * enough to dodge text near-duplicate clustering.
   */
  templateGroups?: Array<{ pattern: string, count: number }>
}

const LOW_COVERAGE_SEVERE_PERCENT = 20
const LOW_COVERAGE_WATCH_PERCENT = 50
const SEVERE_MIN_NOT_INDEXED = 10
const SEVERE_DISCOVERY_SHARE = 0.4
const SEVERE_SELECTION_SHARE = 0.15

function countIssues(issues: SearchConsoleStageIssue[] | null | undefined, ...types: string[]): number {
  if (!issues?.length)
    return 0
  const wanted = new Set(types)
  return issues.reduce((sum, issue) => sum + (wanted.has(issue.type) ? issue.count : 0), 0)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en').format(Math.max(0, Math.round(value)))
}

function percent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`
}

export function indexingDiagnosisCounts(input: IndexingDiagnosisInput): IndexingDiagnosisCounts {
  const totalUrls = Math.max(0, input.totalUrls ?? 0)
  const indexed = Math.max(0, input.indexed ?? 0)
  const notIndexed = Math.max(0, totalUrls - indexed)
  const issues = input.issues ?? []
  return {
    totalUrls,
    indexed,
    notIndexed,
    indexedPercent: totalUrls > 0 ? (indexed / totalUrls) * 100 : 0,
    unknownToGoogle: countIssues(issues, 'unknown_to_google'),
    discoveredNotIndexed: countIssues(issues, 'discovered_not_indexed'),
    crawledNotIndexed: countIssues(issues, 'crawled_not_indexed'),
    hardBlocks: countIssues(
      issues,
      'blocked_robots',
      'server_error',
      'access_denied',
      'access_forbidden',
      'blocked_4xx',
      'redirect_error',
      'crawl_error',
      'not_found',
      'soft_404',
    ),
    // Headline canonical mismatches include path differences and cross-domain
    // selections. Formatting-only differences remain visible as observations.
    canonicalMismatches: countIssues(issues, 'canonical_mismatch', 'canonical_cross_domain'),
    noindex: countIssues(issues, 'noindex'),
    genericNotIndexed: countIssues(issues, 'not_indexed'),
    veryStaleCrawl: countIssues(issues, 'very_stale_crawl'),
  }
}

function specificReasonEvidence(c: IndexingDiagnosisCounts): number {
  return c.unknownToGoogle + c.discoveredNotIndexed + c.crawledNotIndexed + c.hardBlocks + c.canonicalMismatches + c.noindex
}

function hasLowCoverageSevere(c: IndexingDiagnosisCounts): boolean {
  return c.totalUrls >= 20
    && c.notIndexed >= SEVERE_MIN_NOT_INDEXED
    && c.indexedPercent < LOW_COVERAGE_SEVERE_PERCENT
}

function hasLowCoverageWatch(c: IndexingDiagnosisCounts): boolean {
  return c.totalUrls >= 20
    && c.notIndexed >= SEVERE_MIN_NOT_INDEXED
    && c.indexedPercent < LOW_COVERAGE_WATCH_PERCENT
}

function dominantReason(c: IndexingDiagnosisCounts): IndexingDiagnosisReason {
  // `crawl_blocked` is the most optimistic verdict (recovery in days once access is
  // fixed), so it must only fire when hard access faults actually DOMINATE the
  // not-indexed set. A handful of routine 404s sitting alongside a much larger
  // discovery/quality problem is hygiene, not a site-wide crawl block — gating on a
  // small absolute floor (>5) alone mislabels a discovery-starved site (e.g. 6 dead
  // URLs + 52 unknown + 11 crawled-not-indexed) as "just fix crawl access".
  if (c.hardBlocks > Math.max(5, c.totalUrls * 0.05)
    && c.hardBlocks >= c.unknownToGoogle
    && c.hardBlocks >= c.crawledNotIndexed) {
    return 'crawl_blocked'
  }
  // Same dominance rule as `crawl_blocked` (recovery in days once the canonical /
  // noindex is fixed): a canonical-mismatch or noindex blocker must actually exceed
  // the discovery + quality buckets to OWN the headline. Fleet data showed sites with
  // e.g. 49 canonical mismatches but 100 unknown + 95 crawled-not-indexed being
  // mislabelled "fix your canonicals" when discovery/quality is the real driver. The
  // blocker is still surfaced as secondary evidence below; it just doesn't lead.
  const canonBlocks = c.canonicalMismatches > Math.max(5, c.totalUrls * 0.05)
    && c.canonicalMismatches >= c.unknownToGoogle && c.canonicalMismatches >= c.crawledNotIndexed
  const noindexBlocks = c.noindex > Math.max(5, c.totalUrls * 0.1)
    && c.noindex >= c.unknownToGoogle && c.noindex >= c.crawledNotIndexed
  if (canonBlocks || noindexBlocks)
    return 'canonical_or_indexability_blocked'
  if (specificReasonEvidence(c) === 0 && c.genericNotIndexed > 0)
    return 'not_indexed_unspecified'

  const discoverySevere = c.unknownToGoogle >= Math.max(SEVERE_MIN_NOT_INDEXED, c.totalUrls * SEVERE_DISCOVERY_SHARE)
  const discoveredSevere = c.discoveredNotIndexed >= Math.max(SEVERE_MIN_NOT_INDEXED, c.totalUrls * SEVERE_SELECTION_SHARE)
  const crawledSevere = c.crawledNotIndexed >= Math.max(SEVERE_MIN_NOT_INDEXED, c.totalUrls * SEVERE_SELECTION_SHARE)

  const top = [
    ['unknown_to_google_discovery_gap', c.unknownToGoogle],
    ['discovered_not_crawled', c.discoveredNotIndexed],
    ['crawled_not_indexed_quality_selection', c.crawledNotIndexed],
  ] as const

  // Among severe buckets the LARGEST leads. Positional precedence (discovery
  // first, at a higher 0.4 bar) let a discovery gap that merely cleared its bar
  // mask a larger crawled-not-indexed quality problem. Equal counts keep the
  // array's discovery→discovered→crawled order as a stable tiebreak.
  const severe = new Set<IndexingDiagnosisReason>([
    ...(discoverySevere ? ['unknown_to_google_discovery_gap' as const] : []),
    ...(discoveredSevere ? ['discovered_not_crawled' as const] : []),
    ...(crawledSevere ? ['crawled_not_indexed_quality_selection' as const] : []),
  ])
  if (severe.size) {
    return [...top]
      .filter(([reason]) => severe.has(reason))
      .sort((a, b) => b[1] - a[1])[0]![0]
  }

  const [reason, count] = [...top].sort((a, b) => b[1] - a[1])[0]!
  return count > 0 ? reason : 'mixed_indexing_failure'
}

function stageKeyFor(reason: IndexingDiagnosisReason): SearchConsoleStageKey | null {
  switch (reason) {
    case 'crawl_blocked':
      return 'crawl_blocked'
    case 'canonical_or_indexability_blocked':
      return 'indexability_blocked'
    case 'unknown_to_google_discovery_gap':
      return 'weak_discovery'
    case 'discovered_not_crawled':
      return 'discovery_backlog'
    case 'crawled_not_indexed_quality_selection':
    case 'mixed_indexing_failure':
    case 'not_indexed_unspecified':
      return 'index_rejection'
    default:
      return null
  }
}

function copyFor(reason: IndexingDiagnosisReason, c: IndexingDiagnosisCounts): Pick<IndexingDiagnosis, 'summary' | 'primaryAction'> {
  switch (reason) {
    case 'crawl_blocked':
      return {
        summary: `Google is reporting hard access or fetch faults on ${formatCount(c.hardBlocks)} URLs.`,
        primaryAction: 'Fix fetch, server, robots, and broken-response faults before content work.',
      }
    case 'canonical_or_indexability_blocked':
      return {
        summary: 'Google can reach pages, but canonical or indexability signals are preventing clean inclusion.',
        primaryAction: 'Make canonical and index directives agree on the URLs that should rank.',
      }
    case 'unknown_to_google_discovery_gap':
      return {
        summary: `Google still does not know about ${formatCount(c.unknownToGoogle)} of the inspected URLs.`,
        primaryAction: 'Audit sitemap freshness, sitemap membership, and internal links from already-indexed pages.',
      }
    case 'discovered_not_crawled':
      return {
        summary: `Google has discovered ${formatCount(c.discoveredNotIndexed)} URLs but has not crawled them yet.`,
        primaryAction: 'Reduce low-value inventory and strengthen internal links to the pages that should be crawled.',
      }
    case 'crawled_not_indexed_quality_selection':
      return {
        summary: `Google crawled ${formatCount(c.crawledNotIndexed)} URLs but chose not to keep them in the index.`,
        primaryAction: 'Rule out blockers, then improve, consolidate, or noindex thin and duplicate page sets.',
      }
    case 'mixed_indexing_failure':
      return {
        summary: `${formatCount(c.notIndexed)} URLs are not indexed, with multiple Google coverage reasons present.`,
        primaryAction: 'Split the affected URLs by Google coverage reason before changing the site.',
      }
    case 'not_indexed_unspecified':
      return {
        summary: `Google reports ${formatCount(c.genericNotIndexed || c.notIndexed)} URLs as not indexed, but the current diagnostic snapshot does not expose a narrower reason bucket.`,
        primaryAction: 'Refresh URL Inspection diagnostics and join affected URLs to sitemap, internal-link, canonical, fetch, and rendered-content evidence.',
      }
    default:
      return {
        summary: 'Indexed coverage is not showing a broad failure.',
        primaryAction: 'Keep monitoring indexing alongside crawl and search performance.',
      }
  }
}

function sampleUrls(rows: IndexingEvidenceUrl[] | null | undefined): string[] {
  return [...new Set((rows ?? []).map(row => row.url).filter(Boolean))].slice(0, 10)
}

function hasCanonicalMismatch(row: IndexingEvidenceUrl): boolean {
  return !!(row.userCanonical && row.googleCanonical && row.userCanonical !== row.googleCanonical)
}

function sitemapMembership(row: IndexingEvidenceUrl): boolean | null {
  if (row.sitemaps?.length)
    return true
  // This reads the prose, not `parseCoverageState`: the parser maps "Submitted
  // and indexed" and "Indexed, not submitted in sitemap" to one `indexed` tag,
  // and sitemap membership is the part that tag drops.
  const state = row.coverageState?.toLowerCase() ?? ''
  if (state.includes('not submitted in sitemap'))
    return false
  if (state.includes('submitted'))
    return true
  return null
}

function rowsForIssue(rows: IndexingEvidenceUrl[] | null | undefined, issueType: string): IndexingEvidenceUrl[] {
  const all = rows ?? []
  const exact = all.filter(row => row.issueType === issueType)
  if (exact.length)
    return exact
  // gscdump's parser maps Google's coverage prose to the same tag the issue
  // type would carry, so a row with no issue type still joins its bucket.
  if (issueType === 'crawled_not_indexed') {
    const coverage = all.filter(row => parseCoverageState(row.coverageState)._tag === 'crawled_not_indexed')
    if (coverage.length)
      return coverage
  }
  return []
}

interface UrlEvidenceSummary {
  rows: number
  successfulFetches: number
  robotsAllowed: number
  indexingAllowed: number
  canonicalMismatches: number
  sitemapKnown: number
  notInSitemap: number
  referringKnown: number
  internalLinkRows: number
  internalOrphans: number
  zeroKnownInternalLinks: number
  linkedInternalRows: number
  deepInternalPages: number
  suggestedInternalLinkSources: number
  fetchBlockers: number
  robotsBlockers: number
  indexingBlockers: number
  blockerHints: number
  evidence: string[]
}

function summarizeUrlEvidence(rows: IndexingEvidenceUrl[]): UrlEvidenceSummary {
  const successfulFetches = rows.filter(row => row.pageFetchState === 'SUCCESSFUL').length
  const robotsAllowed = rows.filter(row => row.robotsTxtState === 'ALLOWED').length
  const indexingAllowed = rows.filter(row => row.indexingState === 'INDEXING_ALLOWED').length
  const canonicalMismatches = rows.filter(hasCanonicalMismatch).length
  const sitemap = rows.map(sitemapMembership)
  const sitemapKnown = sitemap.filter(value => value !== null).length
  const notInSitemap = sitemap.filter(value => value === false).length
  const referringKnown = rows.filter(row => (row.referringUrls?.length ?? 0) > 0).length
  const internalLinkRows = rows.filter(row =>
    row.internalIncomingLinks != null
    || row.internalIncomingSourcePages != null
    || row.internalIncomingContextualLinks != null
    || row.internalIncomingTemplateLinks != null
    || row.crawlDepth != null
    || row.isInternalLinkOrphan != null,
  ).length
  const internalOrphans = rows.filter(row => row.isInternalLinkOrphan === true).length
  const zeroKnownInternalLinks = rows.filter(row => row.internalIncomingLinks === 0).length
  const linkedInternalRows = rows.filter(row => (row.internalIncomingLinks ?? 0) > 0 || (row.internalIncomingSourcePages ?? 0) > 0).length
  const contextualLinkedRows = rows.filter(row => (row.internalIncomingContextualLinks ?? 0) > 0 || (row.internalIncomingContextualSourcePages ?? 0) > 0).length
  const templateOnlyLinkedRows = rows.filter(row =>
    ((row.internalIncomingLinks ?? 0) > 0 || (row.internalIncomingSourcePages ?? 0) > 0)
    && (row.internalIncomingContextualLinks ?? 0) === 0
    && (row.internalIncomingContextualSourcePages ?? 0) === 0
    && ((row.internalIncomingTemplateLinks ?? 0) > 0 || (row.internalIncomingTemplateSourcePages ?? 0) > 0),
  ).length
  const deepInternalPages = rows.filter(row => (row.crawlDepth ?? 0) >= 3).length
  const suggestedInternalLinkSources = new Set(
    rows.flatMap(row => row.suggestedInternalLinks?.map(source => source.sourceUrl) ?? []),
  ).size
  const fetchBlockers = rows.filter(row => row.pageFetchState && !['SUCCESSFUL', 'PAGE_FETCH_STATE_UNSPECIFIED'].includes(row.pageFetchState)).length
  const robotsBlockers = rows.filter(row => row.robotsTxtState === 'DISALLOWED').length
  const indexingBlockers = rows.filter(row => row.indexingState === 'INDEXING_NOT_ALLOWED').length
  const blockerHints = fetchBlockers + robotsBlockers + indexingBlockers + canonicalMismatches
  const evidence = [
    rows.length ? `${formatCount(rows.length)} affected URLs have URL Inspection sample rows.` : null,
    successfulFetches ? `${successfulFetches}/${rows.length} sampled URLs show a successful fetch.` : null,
    robotsAllowed ? `${robotsAllowed}/${rows.length} sampled URLs are allowed by robots.txt.` : null,
    indexingAllowed ? `${indexingAllowed}/${rows.length} sampled URLs allow indexing directives.` : null,
    canonicalMismatches ? `${canonicalMismatches}/${rows.length} sampled URLs have a Google-selected canonical different from the declared canonical.` : null,
    sitemapKnown ? `${notInSitemap}/${sitemapKnown} sampled URLs with known sitemap status are not submitted in a sitemap.` : null,
    referringKnown ? `${referringKnown}/${rows.length} sampled URLs expose referring URLs in URL Inspection.` : null,
    linkedInternalRows ? `${linkedInternalRows}/${internalLinkRows || rows.length} sampled URLs already have crawl-detected inbound internal links.` : null,
    contextualLinkedRows ? `${contextualLinkedRows}/${internalLinkRows || rows.length} sampled URLs have crawl-detected main-content internal links.` : null,
    templateOnlyLinkedRows ? `${templateOnlyLinkedRows}/${internalLinkRows || rows.length} sampled URLs are only linked from template-like areas in the crawl.` : null,
    internalOrphans ? `${internalOrphans}/${internalLinkRows || rows.length} sampled URLs are crawl-detected internal-link orphans.` : null,
    zeroKnownInternalLinks && zeroKnownInternalLinks !== internalOrphans ? `${zeroKnownInternalLinks}/${internalLinkRows || rows.length} sampled URLs have zero crawl-detected inbound internal links.` : null,
    deepInternalPages ? `${deepInternalPages}/${internalLinkRows || rows.length} sampled URLs are at crawl depth 3 or deeper.` : null,
    suggestedInternalLinkSources ? `${suggestedInternalLinkSources} crawl-detected source pages are available for internal-link recommendations.` : null,
  ].filter(Boolean) as string[]
  return {
    rows: rows.length,
    successfulFetches,
    robotsAllowed,
    indexingAllowed,
    canonicalMismatches,
    sitemapKnown,
    notInSitemap,
    referringKnown,
    internalLinkRows,
    internalOrphans,
    zeroKnownInternalLinks,
    linkedInternalRows,
    deepInternalPages,
    suggestedInternalLinkSources,
    fetchBlockers,
    robotsBlockers,
    indexingBlockers,
    blockerHints,
    evidence,
  }
}

function ruledOutEvidence(c: IndexingDiagnosisCounts, urlEvidence: UrlEvidenceSummary): string[] {
  const ruledOut: string[] = []
  if (c.hardBlocks === 0)
    ruledOut.push('No aggregate robots, fetch, server, or access fault explains the affected set.')
  if (c.canonicalMismatches === 0)
    ruledOut.push('No aggregate canonical mismatch bucket explains the affected set.')
  if (c.noindex === 0)
    ruledOut.push('No aggregate noindex bucket explains the affected set.')
  if (urlEvidence.rows > 0 && urlEvidence.blockerHints === 0)
    ruledOut.push('Sampled URL Inspection rows do not show fetch, robots, indexing-state, or canonical blockers.')
  return ruledOut
}

function issueNotes(c: IndexingDiagnosisCounts, crawledUrlEvidence: UrlEvidenceSummary): IndexingDiagnosisIssueNote[] {
  const notes: IndexingDiagnosisIssueNote[] = []
  if (c.unknownToGoogle > 0) {
    notes.push({
      type: 'unknown_to_google',
      count: c.unknownToGoogle,
      confidence: 'high',
      interpretation: 'Google has no URL Inspection record for this bucket, so the first problem is discovery or sitemap processing rather than page quality.',
      nextEvidence: ['Check current sitemap membership, sitemap freshness, and whether indexed pages link to these URLs.'],
    })
  }
  if (c.discoveredNotIndexed > 0) {
    notes.push({
      type: 'discovered_not_indexed',
      count: c.discoveredNotIndexed,
      confidence: 'medium',
      interpretation: 'Google has found these URLs but has not spent crawl on them yet, which usually points to weak importance signals or too much low-value inventory.',
      nextEvidence: ['Check crawl depth, inbound internal links, sitemap-only URLs, and whether the same template creates many low-demand pages.'],
    })
  }
  if (c.crawledNotIndexed > 0) {
    const obviousBlockers = c.hardBlocks + c.canonicalMismatches + c.noindex
    const sampledBlockers = crawledUrlEvidence.blockerHints
    const confidence: IndexingDiagnosisConfidence = obviousBlockers > 0 || sampledBlockers > 0
      ? 'low'
      : crawledUrlEvidence.rows > 0 && crawledUrlEvidence.successfulFetches > 0
        ? 'medium'
        : 'low'
    notes.push({
      type: 'crawled_not_indexed',
      count: c.crawledNotIndexed,
      confidence,
      interpretation: obviousBlockers > 0 || sampledBlockers > 0
        ? 'Google fetched these URLs, but blocker evidence also exists elsewhere, so the bucket needs URL-level joins before naming one cause.'
        : crawledUrlEvidence.rows > 0
          ? `Google fetched these URLs, and sampled URL Inspection rows do not show a fetch, robots, indexing-state, or canonical blocker. The likely remaining cause is Google quality/selection: thin, duplicate, template-heavy, low-demand, or low-trust pages.`
          : 'Google fetched these URLs, so basic discovery is not the issue for this bucket. With no aggregate robots, fetch, noindex, or canonical blocker explaining it, the likely remaining cause is Google quality/selection: thin, duplicate, template-heavy, low-demand, or low-trust pages.',
      nextEvidence: ['Join each affected URL to rendered text length, duplicate-content clusters, internal inbound links, canonicals, sitemap membership, and search impressions.'],
    })
  }
  return notes
}

function formatSampleRatio(count: number, rows: number, label: string): string | null {
  return count > 0 && rows > 0 ? `${count}/${rows} sampled URLs ${label}` : null
}

function urlPathLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname || '/'
  }
  catch {
    return url
  }
}

function formatUrlExamples(urls: string[], limit = 3): string {
  const unique = [...new Set(urls)].slice(0, limit)
  if (!unique.length)
    return ''
  const labels = unique.map(url => urlPathLabel(url))
  const more = urls.length > unique.length ? ` and ${urls.length - unique.length} more` : ''
  return `${labels.join(', ')}${more}`
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralLabel}`
}

function internalLinkCountsDetail(rows: IndexingEvidenceUrl[], limit = 3): string | null {
  const withKnownCounts = rows
    .filter(row => row.internalIncomingLinks != null || row.internalIncomingSourcePages != null)
    .slice(0, limit)
  if (!withKnownCounts.length)
    return null

  const details = withKnownCounts.map((row) => {
    const links = Math.max(0, row.internalIncomingLinks ?? 0)
    const sourcePages = Math.max(0, row.internalIncomingSourcePages ?? (links > 0 ? 1 : 0))
    const contextualLinks = row.internalIncomingContextualLinks == null ? null : Math.max(0, row.internalIncomingContextualLinks)
    const templateLinks = row.internalIncomingTemplateLinks == null ? null : Math.max(0, row.internalIncomingTemplateLinks)
    const linkQuality = [
      contextualLinks != null && contextualLinks > 0 ? `${plural(contextualLinks, 'main-content link')}` : null,
      contextualLinks === 0 && templateLinks != null && templateLinks > 0 ? '0 main-content links' : null,
      templateLinks != null && templateLinks > 0 ? `${plural(templateLinks, 'template-area link')}` : null,
    ].filter(Boolean).join(', ')
    const qualitySuffix = linkQuality ? ` (${linkQuality})` : ''
    return `${urlPathLabel(row.url)} has ${plural(links, 'crawl-detected internal link')} from ${plural(sourcePages, 'page')}${qualitySuffix}`
  })
  const more = rows.length > withKnownCounts.length ? `; ${formatCount(rows.length - withKnownCounts.length)} more sampled URLs have separate link counts` : ''
  return `Crawl link evidence: ${details.join('; ')}${more}.`
}

function internalLinkEvidenceDetail(rows: IndexingEvidenceUrl[], evidence: UrlEvidenceSummary): string | null {
  const targetRows = rows.filter(row =>
    row.isInternalLinkOrphan === true
    || row.internalIncomingLinks === 0
    || ((row.referringUrls?.length ?? 0) === 0 && row.issueType !== 'crawled_not_indexed'),
  )
  if (!targetRows.length && evidence.deepInternalPages === 0)
    return null

  const targetUrls = targetRows.length
    ? targetRows.map(row => row.url)
    : rows.filter(row => (row.crawlDepth ?? 0) >= 3).map(row => row.url)
  const sourceUrls = targetRows.flatMap(row => row.suggestedInternalLinks?.map(source => source.sourceUrl) ?? [])
  const signals = [
    evidence.internalOrphans > 0 ? `${evidence.internalOrphans} sampled URLs are crawl-detected internal-link orphans` : null,
    evidence.zeroKnownInternalLinks > 0 && evidence.zeroKnownInternalLinks !== evidence.internalOrphans ? `${evidence.zeroKnownInternalLinks} sampled URLs have zero crawl-detected inbound links` : null,
    evidence.deepInternalPages > 0 ? `${evidence.deepInternalPages} sampled URLs are at crawl depth 3 or deeper` : null,
  ].filter(Boolean)

  const targetText = formatUrlExamples(targetUrls)
  const sourceText = formatUrlExamples(sourceUrls)
  const countText = internalLinkCountsDetail(targetRows.length ? targetRows : rows)
  const hasExistingInternalLinks = targetRows.some(row =>
    (row.internalIncomingLinks ?? 0) > 0 || (row.internalIncomingSourcePages ?? 0) > 0,
  )
  const linkAction = hasExistingInternalLinks ? 'Strengthen contextual internal links to' : 'Add contextual internal links to'
  const evidenceText = [
    signals.length ? `${signals.join('; ')}.` : null,
    countText,
  ].filter(Boolean).join(' ')
  const prefix = evidenceText ? `${evidenceText} ` : ''
  if (targetText && sourceText) {
    return `${prefix}${linkAction} ${targetText} from crawl-discovered source pages such as ${sourceText}. Use descriptive anchors that match the target page intent.`
  }
  if (targetText) {
    return `${prefix}${linkAction} ${targetText} from indexed hub, category, docs, blog, or homepage-adjacent pages with existing traffic. Use descriptive anchors that match the target page intent.`
  }
  return `${prefix}${hasExistingInternalLinks ? 'Strengthen contextual internal links from' : 'Add contextual internal links from'} indexed hub, category, docs, blog, or homepage-adjacent pages to the affected deep pages.`
}

function sitemapAndLinkDetail(evidence: UrlEvidenceSummary, rows: IndexingEvidenceUrl[] = []): string {
  const linkCounts = internalLinkCountsDetail(rows)
  const hints = [
    evidence.notInSitemap > 0 && evidence.sitemapKnown > 0
      ? `${evidence.notInSitemap}/${evidence.sitemapKnown} sampled URLs with known sitemap status are missing from sitemaps`
      : null,
    evidence.rows > 0 && evidence.referringKnown === 0
      ? 'sampled URLs do not expose referring URLs in URL Inspection'
      : null,
    evidence.internalOrphans > 0
      ? `${evidence.internalOrphans}/${evidence.internalLinkRows || evidence.rows} sampled URLs are crawl-detected internal-link orphans`
      : null,
    evidence.deepInternalPages > 0
      ? `${evidence.deepInternalPages}/${evidence.internalLinkRows || evidence.rows} sampled URLs are at crawl depth 3 or deeper`
      : null,
    linkCounts?.replace(/\.$/, ''),
  ].filter(Boolean)

  return hints.length
    ? `${hints.join('; ')}. Add canonical URLs to the sitemap, keep lastmod current, and add links from crawlable indexed pages. For the most important pages, request indexing after discovery signals are fixed.`
    : 'Add canonical URLs to the sitemap, keep lastmod current, and link to them from crawlable indexed pages. For the most important pages, request indexing after discovery signals are fixed.'
}

function actionsFor(
  reason: IndexingDiagnosisReason,
  c: IndexingDiagnosisCounts,
  rows: IndexingEvidenceUrl[],
  crawledRows: IndexingEvidenceUrl[],
  urlEvidence: UrlEvidenceSummary,
  crawledUrlEvidence: UrlEvidenceSummary,
): IndexingDiagnosisAction[] {
  const actions: IndexingDiagnosisAction[] = []
  const push = (action: IndexingDiagnosisAction) => {
    if (!actions.some(existing => existing.id === action.id))
      actions.push(action)
  }

  const fetchRobotsEvidence = [
    c.hardBlocks > 0 ? `${formatCount(c.hardBlocks)} aggregate hard access or fetch faults` : null,
    formatSampleRatio(urlEvidence.fetchBlockers, urlEvidence.rows, 'show fetch failures'),
    formatSampleRatio(urlEvidence.robotsBlockers, urlEvidence.rows, 'are blocked by robots.txt'),
  ].filter(Boolean).join('; ')
  if (c.hardBlocks > 0 || urlEvidence.fetchBlockers > 0 || urlEvidence.robotsBlockers > 0) {
    push({
      id: 'fix-crawl-access',
      title: 'Fix the crawl or fetch blocker first',
      detail: `${fetchRobotsEvidence}. Remove unintended robots blocks, server errors, auth/WAF blocks, redirect failures, or broken responses. After Google can fetch the page, request indexing only for important URLs.`,
      why: 'A page must be crawlable before it can become eligible for indexing, but indexing is still not guaranteed.',
      source: { label: 'Google Search Central: Troubleshoot crawling', url: 'https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors' },
    })
  }

  const hasNoindexEvidence = c.noindex > 0 || urlEvidence.indexingBlockers > 0
  const hasCanonicalEvidence = c.canonicalMismatches > 0 || urlEvidence.canonicalMismatches > 0
  if (hasNoindexEvidence || hasCanonicalEvidence) {
    const indexabilityEvidence = [
      c.noindex > 0 ? `${formatCount(c.noindex)} aggregate noindex URLs` : null,
      c.canonicalMismatches > 0 ? `${formatCount(c.canonicalMismatches)} aggregate canonical mismatch URLs` : null,
      formatSampleRatio(urlEvidence.indexingBlockers, urlEvidence.rows, 'show indexing is not allowed'),
      formatSampleRatio(urlEvidence.canonicalMismatches, urlEvidence.rows, 'have Google-selected canonicals that differ from declared canonicals'),
    ].filter(Boolean).join('; ')
    push({
      id: 'align-indexability-signals',
      title: hasNoindexEvidence ? 'Remove unintended noindex or canonical conflicts' : 'Align canonical signals',
      detail: `${indexabilityEvidence}. If the page should appear in Search, remove noindex directives and make sure robots allows crawl. If Google selected another canonical, align canonicals, redirects, sitemap URLs, and internal links to the preferred URL.`,
      why: 'Noindex explicitly asks Google not to index a URL, and canonical signals tell Google which duplicate or alternate URL should be indexed.',
      // §1 "duplicate, Google chose different canonical" → wrong fix is content rewrites.
      ...(hasCanonicalEvidence
        ? { antiAdvice: 'When Google has chosen a different canonical, rewriting the page content will not change its decision — this is a consolidation, not a quality problem. Point every signal (canonical tag, redirects, sitemap, internal links) at one preferred URL.' }
        : {}),
      source: {
        label: hasNoindexEvidence ? 'Google Search Central: Block Search indexing with noindex' : 'Google Search Central: Canonicalization',
        url: hasNoindexEvidence
          ? 'https://developers.google.com/search/docs/crawling-indexing/block-indexing'
          : 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
      },
    })
  }

  if (reason === 'data_incomplete') {
    push({
      id: 'complete-indexing-data',
      title: 'Complete URL Inspection data first',
      detail: 'Run or refresh URL Inspection ingestion so the diagnosis can see coverage reason, fetch status, robots, indexing directives, canonical selection, sitemap membership, and referring URLs.',
      why: 'Without URL-level inspection evidence, the product cannot responsibly name why Google is excluding pages.',
      source: { label: 'Search Console Help: URL Inspection tool', url: 'https://support.google.com/webmasters/answer/9012289' },
    })
  }

  if (c.unknownToGoogle > 0) {
    const linkDetail = internalLinkEvidenceDetail(rowsForIssue(rows, 'unknown_to_google'), urlEvidence)
    push({
      id: 'improve-discovery',
      title: 'Make these URLs discoverable',
      detail: `${formatCount(c.unknownToGoogle)} URLs are unknown to Google. ${linkDetail ?? sitemapAndLinkDetail(urlEvidence, rowsForIssue(rows, 'unknown_to_google'))}`,
      why: 'Sitemaps and internal links help Google discover URLs; they do not guarantee indexing.',
      source: { label: 'Google Search Central: Build and submit a sitemap', url: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap' },
    })
  }

  if (c.discoveredNotIndexed > 0) {
    const discoveredRows = rowsForIssue(rows, 'discovered_not_indexed')
    const linkDetail = internalLinkEvidenceDetail(discoveredRows, discoveredRows.length ? summarizeUrlEvidence(discoveredRows) : urlEvidence)
    push({
      id: 'strengthen-crawl-priority',
      title: 'Strengthen crawl priority',
      detail: `${formatCount(c.discoveredNotIndexed)} URLs are discovered but not crawled. ${linkDetail ?? 'Reduce duplicate or low-value URL inventory, add internal links from important pages, check robots and server capacity, and keep only useful canonical URLs in the sitemap.'}`,
      why: 'Google has found these URLs but has not crawled them yet, which often points to weak importance signals or crawl waste.',
      source: { label: 'Google Search Central: Crawl budget', url: 'https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget' },
    })
  }

  if (c.crawledNotIndexed > 0) {
    if (crawledUrlEvidence.rows === 0) {
      push({
        id: 'run-url-level-triage',
        title: 'Collect URL-level evidence for crawled pages',
        detail: `${formatCount(c.crawledNotIndexed)} URLs were crawled but not indexed, but this snapshot has no sampled rows for that bucket. Join affected URLs to live fetch, robots, noindex, canonical selection, sitemap membership, internal links, rendered content, duplicate clusters, and manual/security/removal checks before naming one cause.`,
        why: 'Crawled-but-not-indexed is a selection outcome, not a single root cause. The next action should close the evidence gap before changing content at scale.',
        source: { label: 'Search Console Help: URL Inspection tool', url: 'https://support.google.com/webmasters/answer/9012289' },
      })
    }
    else if (crawledUrlEvidence.blockerHints === 0) {
      const linkDetail = internalLinkEvidenceDetail(crawledRows, crawledUrlEvidence)
      push({
        id: 'improve-or-consolidate-content',
        title: 'Improve or consolidate crawled pages before requesting indexing',
        detail: `${crawledUrlEvidence.successfulFetches}/${crawledUrlEvidence.rows} sampled crawled-but-not-indexed URLs fetched successfully, with no sampled fetch, robots, indexing-state, or canonical blockers. ${linkDetail ?? 'Inspect rendered HTML, compare duplicates and canonicals, strengthen internal links, improve unique value, consolidate near-duplicates, or noindex pages that should not rank.'} Request indexing after meaningful changes.`,
        why: 'Google crawled these URLs but did not keep them in the index; when access and indexability blockers are ruled out, quality, duplication, usefulness, or site trust become the likely remaining causes.',
        // §1 "crawled_not_indexed" → wrong fix is "add internal links / resubmit".
        antiAdvice: 'Adding internal links, resubmitting the URL, or pinging IndexNow will not move this — discovery signals change whether Google finds a URL, not whether it keeps a crawled one. Fix the page value or consolidate duplicates first.',
        source: { label: 'Google Search Central: Creating helpful content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
      })
    }
  }

  if ((reason === 'not_indexed_unspecified' || reason === 'mixed_indexing_failure')
    || (actions.length === 0 && c.notIndexed > 0)) {
    push({
      id: 'run-url-level-triage',
      title: 'Split affected URLs by URL Inspection evidence',
      detail: 'Check live fetch, robots, noindex, canonical selection, sitemap membership, internal links, manual actions, removals, and rendered content before naming one cause.',
      why: `${formatCount(c.notIndexed)} URLs are not indexed, but the current evidence is not specific enough to name a single cause responsibly.`,
      source: { label: 'Search Console Help: URL Inspection tool', url: 'https://support.google.com/webmasters/answer/9012289' },
    })
  }

  const priority = (action: IndexingDiagnosisAction): number => {
    if (action.id === 'fix-crawl-access')
      return reason === 'crawl_blocked' ? 0 : 3
    if (action.id === 'align-indexability-signals')
      return 1
    if (reason === 'unknown_to_google_discovery_gap' && action.id === 'improve-discovery')
      return 2
    if (reason === 'discovered_not_crawled' && action.id === 'strengthen-crawl-priority')
      return 2
    if (reason === 'crawled_not_indexed_quality_selection' && (action.id === 'improve-or-consolidate-content' || action.id === 'run-url-level-triage'))
      return 2
    if ((reason === 'not_indexed_unspecified' || reason === 'mixed_indexing_failure') && action.id === 'run-url-level-triage')
      return 2
    if (action.id === 'complete-indexing-data')
      return 3
    if (action.id === 'improve-discovery')
      return 4
    if (action.id === 'strengthen-crawl-priority')
      return 5
    if (action.id === 'improve-or-consolidate-content')
      return 6
    return 7
  }

  return actions.sort((a, b) => priority(a) - priority(b)).slice(0, 3)
}

export function diagnoseIndexing(input: IndexingDiagnosisInput): IndexingDiagnosis {
  const counts = indexingDiagnosisCounts(input)
  if (counts.totalUrls === 0) {
    const copy = copyFor('data_incomplete', counts)
    const emptyEvidence = summarizeUrlEvidence([])
    const recommendedActions = actionsFor('data_incomplete', counts, [], [], emptyEvidence, emptyEvidence)
    return {
      reason: 'data_incomplete',
      severity: 'watch',
      confidence: 'low',
      stageKey: null,
      ...copy,
      primaryAction: recommendedActions[0]?.detail ?? copy.primaryAction,
      counts,
      evidence: ['No URL Inspection inventory is available yet.'],
      ruledOut: [],
      missingEvidence: ['Need completed URL Inspection data before diagnosing indexing reasons.'],
      hiddenRisks: [],
      issueNotes: [],
      recommendedActions,
      sampleUrls: [],
    }
  }

  if (counts.notIndexed === 0) {
    const copy = copyFor('none', counts)
    const emptyEvidence = summarizeUrlEvidence([])
    const recommendedActions = actionsFor('none', counts, [], [], emptyEvidence, emptyEvidence)
    return {
      reason: 'none',
      severity: 'ok',
      confidence: 'high',
      stageKey: null,
      ...copy,
      primaryAction: recommendedActions[0]?.detail ?? copy.primaryAction,
      counts,
      evidence: [`${formatCount(counts.indexed)} of ${formatCount(counts.totalUrls)} inspected URLs are indexed.`],
      ruledOut: [],
      missingEvidence: [],
      hiddenRisks: [],
      issueNotes: [],
      recommendedActions,
      sampleUrls: sampleUrls(input.sampleUrls),
    }
  }

  const rows = input.sampleUrls ?? []
  const crawledRows = rowsForIssue(rows, 'crawled_not_indexed')
  const crawledUrlEvidence = summarizeUrlEvidence(crawledRows)
  const urlEvidence = summarizeUrlEvidence(crawledRows.length ? crawledRows : rows)
  const hasReasonEvidence = specificReasonEvidence(counts) > 0 || counts.genericNotIndexed > 0
  const severe = hasReasonEvidence && hasLowCoverageSevere(counts)
  const watch = severe || hasLowCoverageWatch(counts)
  const reason = dominantReason(counts)
  // Discovery sub-diagnosis: are the unknown URLs well-linked-but-unknown (Google has
  // the path and is not crawling = crawl demand) or orphaned (genuinely linking-fixable)?
  const discoveryWellLinked = reason === 'unknown_to_google_discovery_gap'
    ? discoveryWellLinkedShare(rowsForIssue(rows, 'unknown_to_google'))
    : null
  const discoveryCrawlDemandGated = discoveryWellLinked != null && discoveryWellLinked >= DISCOVERY_WELL_LINKED_SHARE
  const copy = copyFor(reason, counts)
  const recommendedActions = actionsFor(reason, counts, rows, crawledRows, urlEvidence, crawledUrlEvidence)
  const confidence: IndexingDiagnosisConfidence = severe
    ? reason === 'not_indexed_unspecified'
      ? 'low'
      : reason === 'crawled_not_indexed_quality_selection'
        ? crawledUrlEvidence.blockerHints > 0 ? 'low' : 'medium'
        : 'high'
    : 'low'
  const directEvidence = [
    `${formatCount(counts.indexed)} of ${formatCount(counts.totalUrls)} inspected URLs are indexed (${percent(counts.indexedPercent)}).`,
    `${formatCount(counts.notIndexed)} inspected URLs are not indexed.`,
    counts.unknownToGoogle > 0 ? `${formatCount(counts.unknownToGoogle)} URLs are unknown to Google.` : null,
    counts.discoveredNotIndexed > 0 ? `${formatCount(counts.discoveredNotIndexed)} URLs are discovered but not crawled.` : null,
    counts.crawledNotIndexed > 0 ? `${formatCount(counts.crawledNotIndexed)} URLs were crawled but not indexed.` : null,
    // Secondary blockers — surfaced even when demoted from the headline reason, so a
    // co-present canonical/noindex/access fault is never silently dropped.
    counts.canonicalMismatches > 0 ? `${formatCount(counts.canonicalMismatches)} URLs declare a canonical Google overrode with its own pick.` : null,
    counts.noindex > 0 ? `${formatCount(counts.noindex)} URLs carry a noindex directive.` : null,
    counts.hardBlocks > 0 ? `${formatCount(counts.hardBlocks)} URLs returned an access fault (404, soft-404, or server error).` : null,
    // Crawl-demand corroboration: Google has stopped re-crawling these — the signal
    // that distinguishes a quality-gated, crawl-starved site from a fresh discovery gap.
    counts.veryStaleCrawl > 0 ? `${formatCount(counts.veryStaleCrawl)} URLs have not been re-crawled by Google in 60+ days (crawl-demand decay).` : null,
    // Discovery sub-diagnosis: well-linked-but-unknown means the lever is crawl demand,
    // not internal linking (the URLs already have a crawl path Google is not using).
    discoveryCrawlDemandGated ? `Most sampled unknown URLs already have crawl-detected inbound internal links, so Google has a path to them and is declining to crawl — the gap is crawl demand, not internal linking.` : null,
    specificReasonEvidence(counts) === 0 && counts.genericNotIndexed > 0 ? `${formatCount(counts.genericNotIndexed)} URLs are in Google's broad not-indexed bucket without a narrower reason in this snapshot.` : null,
    ...urlEvidence.evidence,
  ].filter(Boolean) as string[]

  return {
    reason,
    severity: severe ? 'severe' : watch ? 'watch' : 'ok',
    confidence,
    stageKey: severe ? stageKeyFor(reason) : null,
    ...copy,
    primaryAction: recommendedActions[0]?.detail ?? copy.primaryAction,
    counts,
    evidence: directEvidence,
    ruledOut: ruledOutEvidence(counts, urlEvidence),
    missingEvidence: [
      ...(counts.genericNotIndexed > 0 && specificReasonEvidence(counts) === 0
        ? ['Need narrower URL Inspection coverage reasons; the current snapshot only exposes the broad not-indexed aggregate.']
        : []),
      ...(crawledRows.length === 0 && counts.crawledNotIndexed > 0
        ? ['Need URL-level URL Inspection samples for the crawled-but-not-indexed bucket.']
        : []),
      'Rendered-content, duplicate-template, internal-link, and sitemap-membership joins increase confidence.',
      'Google does not expose exact quality, policy, or site-trust classifiers through URL Inspection.',
    ],
    hiddenRisks: [
      'Scaled generated or near-duplicate pages can be crawled but left out of the index.',
      'UGC/spam, doorway-like inventory, hacked content, or policy issues may suppress indexing without a precise URL Inspection reason.',
      'Weak site-level demand or trust can leave technically valid pages unselected for indexing.',
    ],
    issueNotes: issueNotes(counts, crawledUrlEvidence),
    recommendedActions,
    sampleUrls: sampleUrls(input.sampleUrls),
    // T3.1 — crawl-recency histogram over the sample rows' retained lastCrawlTime.
    ...(rows.length ? { crawlRecency: buildCrawlRecencyHistogram(rows) } : {}),
    ...(discoveryCrawlDemandGated ? { discoveryCrawlDemandGated: true } : {}),
  }
}

export function diagnoseSearchConsoleStageInput(input: ClassifySearchConsoleStageInput): IndexingDiagnosis {
  return diagnoseIndexing({
    totalUrls: input.summary?.totalUrls,
    indexed: input.summary?.indexed,
    issues: input.issues,
  })
}

export function isSevereIndexingDiagnosis(diagnosis: IndexingDiagnosis | null | undefined): boolean {
  return diagnosis?.severity === 'severe' && diagnosis.stageKey != null
}

// ─── Recoverability prognosis (T2.3) ────────────────────────────────────────

function prognosisBand(cls: 'fast' | 'medium' | 'slow', coreUpdateGated: boolean): string {
  if (cls === 'fast')
    return 'days once fixed'
  if (cls === 'medium')
    return 'weeks as signals build'
  return coreUpdateGated ? 'a core update away, often partial' : 'weeks to months'
}

/**
 * Is there a SEVERE crawled-not-indexed quality signal in these counts — the same
 * `crawledSevere` bar `dominantReason` uses. A discovery gap can be numerically
 * larger (more `unknown_to_google` URLs) yet sit ON TOP OF a quality/selection
 * verdict: Google crawled a material set, refused it, and so caps how much of the
 * site it will crawl. When that co-severe quality signal is present, a
 * discovery-dominant diagnosis is still core-update-gated — discovery fixes raise
 * the ceiling but cannot lift the crawl-demand cap the quality verdict imposes.
 */
function hasCoSevereQualitySignal(c: IndexingDiagnosisCounts): boolean {
  return c.crawledNotIndexed >= Math.max(SEVERE_MIN_NOT_INDEXED, c.totalUrls * SEVERE_SELECTION_SHARE)
}

// Need a few link-enriched sample rows before reading the orphan-vs-linked split —
// one or two rows is noise, not a site-level pattern.
const DISCOVERY_LINK_SAMPLE_MIN = 3

/**
 * Among the sampled `unknown_to_google` rows that carry crawl link data, the share
 * that are WELL-LINKED inside the site (not an orphan, with real inbound internal
 * links) rather than orphaned. `null` when too few rows carry link data to judge.
 *
 * This is the discovery sub-diagnosis: a high share means Google has a clear internal
 * path to these URLs and STILL has not discovered them — that is not a linking-
 * mechanics gap a hub link fixes, it is crawl demand (Google declining to crawl that
 * part of the site, the same collapse a quality verdict drives). A low share (mostly
 * orphans) is the genuinely linking-fixable case.
 */
function discoveryWellLinkedShare(unknownRows: IndexingEvidenceUrl[]): number | null {
  const linkRows = unknownRows.filter(r =>
    r.internalIncomingLinks != null
    || r.internalIncomingSourcePages != null
    || r.isInternalLinkOrphan != null,
  )
  if (linkRows.length < DISCOVERY_LINK_SAMPLE_MIN)
    return null
  const wellLinked = linkRows.filter(r =>
    r.isInternalLinkOrphan !== true
    && ((r.internalIncomingLinks ?? 0) > 0 || (r.internalIncomingSourcePages ?? 0) > 0),
  ).length
  return wellLinked / linkRows.length
}

/**
 * Map a diagnosis (cause) + site maturity to a recovery-speed band. Pure: the
 * caller supplies `isNewSite` (this module deliberately has no age/authority). The
 * cause sets the lever — a technical block clears in days, a discovery gap in
 * weeks, a quality/selection rejection waits on a broad core update — and a new
 * site's signal ramp slows the discovery/crawl-demand cases by a band.
 */
export function deriveIndexingPrognosis(
  diagnosis: Pick<IndexingDiagnosis, 'reason' | 'counts' | 'discoveryCrawlDemandGated'>,
  opts: { isNewSite: boolean },
): IndexingPrognosis | undefined {
  const make = (cls: 'fast' | 'medium' | 'slow', coreUpdateGated: boolean): IndexingPrognosis =>
    ({ class: cls, coreUpdateGated, band: prognosisBand(cls, coreUpdateGated) })
  switch (diagnosis.reason) {
    case 'crawl_blocked':
    case 'canonical_or_indexability_blocked':
      // A technical block (access fault, canonical confusion) re-crawls fast once fixed.
      return make('fast', false)
    case 'unknown_to_google_discovery_gap':
    case 'discovered_not_crawled':
      // Discovery / crawl-demand: weeks normally; a new site's ramp pushes it slower.
      // BUT it is core-update-gated when EITHER a co-severe crawled-not-indexed quality
      // verdict sits underneath (Google crawled a material set and refused it), OR the
      // unknown URLs are already well-linked internally (Google has the path and is
      // declining to crawl — crawl demand, not a linking gap). Both cap crawl demand in a
      // way discovery work alone cannot lift, even though discovery is the visible symptom.
      if (hasCoSevereQualitySignal(diagnosis.counts) || diagnosis.discoveryCrawlDemandGated)
        return make('slow', true)
      return make(opts.isNewSite ? 'slow' : 'medium', false)
    case 'crawled_not_indexed_quality_selection':
      // Quality/selection rejection: re-inclusion typically follows a core update.
      return make('slow', true)
    case 'mixed_indexing_failure':
    case 'not_indexed_unspecified':
      // Quality signal present → treat as core-update-gated; else needs triage (medium).
      return diagnosis.counts.crawledNotIndexed > 0 ? make('slow', true) : make('medium', false)
    default:
      return undefined
  }
}

// Google source URLs reused across the self-audit items.
const SPAM_POLICIES = 'https://developers.google.com/search/docs/essentials/spam-policies'
const HELPFUL_CONTENT = 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'

/**
 * The crawled-not-indexed quality self-audit (vetted, deterministic copy only —
 * never model-authored, per the why-templates firewall). When Google has crawled a
 * set of pages and refused to keep them, it has made a quality/selection call it
 * will not explain. These are the levers its published guidance actually names, in
 * plain dev/founder English, so the owner can audit their own pages — the one input
 * we cannot read from our side. Clearing them is what ramps the site's crawl demand
 * so the pages Google has not yet crawled start getting fetched too.
 */
/**
 * Vetted, deterministic evidence string for a lever (T3.6) — formatted from the
 * measured numbers only, never free text, so the why-templates firewall holds.
 * Returns undefined when the evidence object carries no signal for this lever.
 */
function selfAuditLeverEvidence(id: QualitySelfAuditItem['id'], evidence: QualitySelfAuditEvidence): string | undefined {
  // Only surface the chrome line when chrome actually DOMINATES the page (> half the
  // rendered words). A modest ratio is healthy, not a finding — showing "15% is
  // chrome" would read as a problem where there is none. Validated on writizzy: the
  // measured median was 90%, with the unimpeachable /compare/* floor at 78%.
  if (id === 'thin-relative-to-length' && evidence.chrome && evidence.chrome.chromePct >= CHROME_DOMINATES_PCT) {
    const { chromePct, sampleSize } = evidence.chrome
    return `On ${sampleSize === 1 ? 'the page' : `the ${sampleSize} pages`} we measured, about ${Math.round(chromePct)}% of the rendered words is shared navigation, footer, and boilerplate rather than content unique to the page.`
  }
  if (id === 'templated-at-scale' && evidence.templateGroups?.length) {
    // Show every group the producer surfaced (already capped at 5). Do NOT re-truncate
    // here — a benign-but-large set (e.g. /docs/*) must not crowd the most diagnostic
    // set (e.g. /compare/*) off the line.
    const phrase = evidence.templateGroups.map(g => `${g.count} under ${g.pattern}`).join(', ')
    return `This crawl found near-structurally-identical page sets: ${phrase}. Each set shares one template with the entity swapped.`
  }
  return undefined
}

/**
 * Build the self-audit. With no `evidence`, every lever carries only its generic
 * vetted line. With per-site `evidence` (measured at the Sprint-context layer,
 * T3.6), the matching levers gain a deterministic evidence string so the check
 * reads as a diagnosis ("~80% of rendered words is chrome") rather than a generic
 * question.
 */
export function buildQualitySelfAudit(evidence?: QualitySelfAuditEvidence): QualitySelfAudit {
  const audit = buildQualitySelfAuditBase()
  if (!evidence)
    return audit
  return {
    ...audit,
    items: audit.items.map((item) => {
      const ev = selfAuditLeverEvidence(item.id, evidence)
      return ev ? { ...item, evidence: ev } : item
    }),
  }
}

function buildQualitySelfAuditBase(): QualitySelfAudit {
  return {
    intro:
      'Google crawled these pages and chose not to keep them. That is a quality and selection call, not a technical block, and Google does not tell you the reason — it is the one cause we cannot prove from our side. Audit your own pages against the levers Google\'s guidance names below; the pages that clear this bar are what convince Google the site is worth more crawling, so the URLs it has not fetched yet start getting crawled too.',
    items: [
      {
        id: 'scaled-content',
        check: 'Were these pages generated or assembled at scale mainly to rank for search, rather than for a reader who chose to land on them? Google\'s scaled-content-abuse policy targets mass-produced pages whether a human, a template, or an AI wrote them — authorship is not the test, the "made primarily for ranking" intent is.',
        why: 'Scaled content abuse is a named spam policy; pages produced at scale primarily for search are devalued or left out of the index regardless of how they were written.',
        source: { label: 'Google Search Central: Spam policies (scaled content abuse)', url: SPAM_POLICIES },
      },
      {
        id: 'thin-relative-to-length',
        check: 'Of the words the page renders, how much is genuinely unique to this page versus shared navigation, footer, sidebar, repeated calls-to-action, and boilerplate? A page can show a high word count and still carry very little content a reader could not get on any other page of the site.',
        why: 'Helpfulness is judged on the unique value a page adds, not its raw length; a long page that is mostly chrome and restated boilerplate reads as low value.',
        source: { label: 'Google Search Central: Creating helpful content (self-assessment)', url: HELPFUL_CONTENT },
      },
      {
        id: 'templated-at-scale',
        check: 'Do many pages share the same structural template with only an entity swapped (one page per competitor, per feature, per integration)? Even when each page\'s prose is distinct enough to look unique, a large set of near-structurally-identical pages reads as programmatic and competes against itself for the same crawl budget.',
        why: 'Programmatic, near-identical page sets are a classic scaled-content pattern; Google crawls a sample, judges the template, and stops spending crawl on the rest.',
        source: { label: 'Google Search Central: Spam policies (scaled content abuse)', url: SPAM_POLICIES },
      },
      {
        id: 'experience-eeat',
        check: 'Does each page show real first-hand experience — a named author with relevant expertise, original screenshots or data, specifics only someone who used the thing would know — or is it generic synthesis that could have been written without ever touching the product?',
        why: 'Google\'s helpful-content self-assessment weighs experience, expertise, and original first-hand insight; generic synthesis with no demonstrated experience is exactly what its quality systems demote.',
        source: { label: 'Google Search Central: Creating helpful content (E-E-A-T self-assessment)', url: HELPFUL_CONTENT },
      },
      {
        id: 'intent-differentiation',
        check: 'Does the page match what someone searching this topic actually wants better than the pages that already rank — and is it differentiated from the very source it talks about? A comparison or feature page that mostly restates a competitor\'s own marketing gives a searcher no reason to keep it over the original.',
        why: 'Google selects the page that best serves the query intent; a page that is neither more useful than the incumbents nor differentiated from its subject has no selection case to make.',
        source: { label: 'Google Search Central: Creating helpful content (people-first content)', url: HELPFUL_CONTENT },
      },
    ],
  }
}

/** Remove sentences that suggest requesting indexing (discovery fix) from an action detail. */
function stripRequestIndexing(detail: string): string {
  return detail
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !/request index/i.test(sentence))
    .join(' ')
    .trim()
}

/**
 * Compose the recoverability prognosis onto a diagnosis and gate its actions.
 * Applied at the Sprint-context layer (which knows `isNewSite`). When the verdict
 * is `slow`/`coreUpdateGated`, "request indexing" advice is stripped from the
 * actions — resubmitting cannot move a quality/selection decision (the prognosis
 * and the T1.4 anti-advice become one mechanism). No-op when the cause has no
 * prognosis (e.g. fully indexed / data-incomplete).
 */
export function applyRecoverabilityPrognosis(
  diagnosis: IndexingDiagnosis,
  opts: { isNewSite: boolean, selfAuditEvidence?: QualitySelfAuditEvidence },
): IndexingDiagnosis {
  const prognosis = deriveIndexingPrognosis(diagnosis, opts)
  if (!prognosis)
    return diagnosis
  const gated = prognosis.class === 'slow' || prognosis.coreUpdateGated
  if (!gated)
    return { ...diagnosis, prognosis }

  const recommendedActions = diagnosis.recommendedActions.map((action) => {
    let detail = stripRequestIndexing(action.detail)
    if (prognosis.coreUpdateGated && action.id === 'improve-or-consolidate-content') {
      detail = `${detail} Re-inclusion of a quality-rejected set typically follows a broad Google core update, so expect partial recovery over months, not days — do not resubmit to force it.`
    }
    // Discovery-dominant but quality-gated: the discovery work is real, but say plainly
    // that a co-present quality verdict caps site-wide crawl demand, so discovery alone
    // won't fully recover indexing (the T1.4 anti-advice for this combined bucket).
    if (prognosis.coreUpdateGated && action.id === 'improve-discovery' && diagnosis.counts.crawledNotIndexed > 0) {
      detail = `${detail} Note: Google already crawled ${formatCount(diagnosis.counts.crawledNotIndexed)} pages and left them unindexed — a quality/selection verdict that caps how much of this site Google will crawl. Making the unknown URLs discoverable helps, but the site-wide crawl demand will not lift until the crawled-not-indexed pages clear Google's quality bar, which typically follows a core update.`
    }
    // Well-linked-but-unknown (no crawled-not-indexed signal): the URLs already have a
    // crawl path, so "add more internal links" is the wrong lever — the gap is crawl demand.
    else if (prognosis.coreUpdateGated && action.id === 'improve-discovery' && diagnosis.discoveryCrawlDemandGated) {
      detail = `${detail} Note: these URLs already have crawl-detected internal links, so Google has a path and is choosing not to crawl them — the lever is crawl demand (the site proving it is worth more crawling), not more internal links. That typically lifts over a core update, not on resubmission.`
    }
    return detail === action.detail ? action : { ...action, detail }
  })
  return {
    ...diagnosis,
    prognosis,
    recommendedActions,
    primaryAction: recommendedActions[0]?.detail ?? diagnosis.primaryAction,
    // A core-update-gated verdict IS the quality/selection bucket — hand the owner the
    // deterministic self-audit of what to check on their own pages (the cause we can't
    // prove). Only here: discovery/canonical/technical buckets get no self-audit.
    ...(prognosis.coreUpdateGated ? { qualitySelfAudit: buildQualitySelfAudit(opts.selfAuditEvidence) } : {}),
  }
}

export function applyIndexingDiagnosisToSiteTriage<T extends SiteTriage>(
  triage: T,
  diagnosis: IndexingDiagnosis,
): T {
  if (!isSevereIndexingDiagnosis(diagnosis) || triage.health.stage !== 'healthy')
    return triage

  const health = diagnosis.reason === 'crawl_blocked'
    ? {
        stage: 'crawl_faults' as const,
        summary: diagnosis.summary,
        primaryAction: diagnosis.primaryAction,
        evidence: [
          { label: 'Access faults', value: String(diagnosis.counts.hardBlocks) },
          { label: 'Indexed pages', value: `${diagnosis.counts.indexed} of ${diagnosis.counts.totalUrls}` },
        ],
        progression: {
          nextStage: 'healthy' as const,
          metric: 'access faults',
          value: diagnosis.counts.hardBlocks,
          target: Math.max(1, Math.floor(diagnosis.counts.totalUrls * 0.05)),
          pct: 0,
          gapLabel: diagnosis.summary,
          direction: 'escape' as const,
        },
      }
    : {
        stage: 'quality_rejection' as const,
        summary: diagnosis.summary,
        primaryAction: diagnosis.primaryAction,
        evidence: [
          { label: 'Not indexed', value: `${diagnosis.counts.notIndexed} of ${diagnosis.counts.totalUrls}` },
          diagnosis.counts.unknownToGoogle > 0
            ? { label: 'Unknown to Google', value: String(diagnosis.counts.unknownToGoogle) }
            : null,
          diagnosis.counts.crawledNotIndexed > 0
            ? { label: 'Crawled, then refused', value: String(diagnosis.counts.crawledNotIndexed) }
            : null,
          specificReasonEvidence(diagnosis.counts) === 0 && diagnosis.counts.genericNotIndexed > 0
            ? { label: 'Not indexed', value: String(diagnosis.counts.genericNotIndexed) }
            : null,
          // T2.3 — honest recovery outlook band (only when a prognosis was composed).
          diagnosis.prognosis
            ? { label: 'Outlook', value: diagnosis.prognosis.band }
            : null,
        ].filter(Boolean) as T['health']['evidence'],
        progression: {
          nextStage: 'healthy' as const,
          metric: 'indexed coverage',
          value: diagnosis.counts.indexedPercent / 100,
          target: 0.2,
          pct: Math.max(0, Math.min(1, diagnosis.counts.indexedPercent / 20)),
          gapLabel: `${diagnosis.counts.indexed} of ${diagnosis.counts.totalUrls} URLs indexed`,
          direction: 'escape' as const,
        },
      }

  return {
    ...triage,
    health,
    headline: 'health',
  }
}
