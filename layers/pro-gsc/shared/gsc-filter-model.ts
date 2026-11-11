// The pure half of the GSC filter state: the vocabulary each control offers,
// and the predicates a mode compiles into. No Vue and no Nuxt, so the same
// definitions are readable from a server handler and testable without a DOM.
//
// `useProGscFilters` owns the reactive half and re-exports everything here.
import type { GscSearchType } from '@gscdump/contracts'
import type { Period } from '@gscdump/sdk/period'
import type { GscColumn } from '@gscdump/sdk/period-presets'
import type { GscFacet } from './utils/gsc-facets'
import { SEARCH_TYPE_CAPABILITIES } from '@gscdump/contracts'
import { parseCustomPeriod } from '@gscdump/sdk/period'
import { PERIOD_PRESETS } from '@gscdump/sdk/period-presets'
import { parseReportingDay } from '@nuxtseo/design-system/app/composables/formatting'
import { brandQueryVariants, foldBrandQuery, normalizeBrandKeywords } from './brand-queries'

/** Stable data trims the incomplete tail of the reporting window by default. */
export const DEFAULT_STABLE_DATA = true

/**
 * The `stableData` argument, parsed at the SDK boundary.
 *
 * `periodToDateRange(period, stableDataOrOptions)` branches on
 * `typeof stableDataOrOptions === 'boolean'` and treats everything else as an
 * options object. `typeof null === 'object'`, so a null argument reads
 * `null.stableData` and throws. Null reaches the SDK because a hydrated
 * `useState` payload slot can carry it behind a `Ref<boolean>`.
 */
export function resolveStableData(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_STABLE_DATA
}

/**
 * What each chart metric means, for the icon-only metric toggle's tooltip. The
 * toggle is four glyphs; without this the user has to click one to find out
 * what it was. Same wording as the per-metric column headers.
 */
export const GSC_COLUMN_TOOLTIPS: Record<GscColumn, string> = {
  clicks: 'Clicks from Google Search results to this site.',
  impressions: 'Times a page from this site appeared in Google Search results.',
  ctr: 'Share of impressions that earned a click.',
  position: 'Average ranking position across impressions. Lower is better.',
}

/** The trailing entity counts on a Search Console row: surface, not traffic. */
export type GscEntityCount = 'queries' | 'pages'

export interface GscEntityCountOption {
  key: GscEntityCount
  label: string
  icon: string
  color: string
  tooltip: string
}

/**
 * Queries and Pages ranked. `search` means queries and `file` means pages, the
 * same glyphs the dimension picker uses, so one shape means one entity across
 * the dashboard.
 */
export const GSC_ENTITY_COUNT_OPTIONS: GscEntityCountOption[] = [
  { key: 'queries', label: 'Queries', icon: 'search', color: 'blue', tooltip: 'Distinct search queries this site ranked for. Google withholds rare queries, so read it as a floor.' },
  { key: 'pages', label: 'Pages', icon: 'file', color: 'lime', tooltip: 'Distinct pages of this site that appeared in results in the period.' },
]

export interface SearchTypeOption {
  value: GscSearchType
  label: string
  icon: string
}

// UI-only presentation for each search-type slice. The slice list itself is the
// keys of `SEARCH_TYPE_CAPABILITIES`, so a new slice upstream fails loudly here
// with a missing label instead of silently vanishing.
const SEARCH_TYPE_UI: Record<GscSearchType, { label: string, icon: string }> = {
  web: { label: 'Web', icon: 'globe' },
  image: { label: 'Images', icon: 'image' },
  video: { label: 'Video', icon: 'video' },
  news: { label: 'News', icon: 'newspaper' },
  discover: { label: 'Discover', icon: 'compass' },
  googleNews: { label: 'Google News', icon: 'i-lucide-rss' },
}

/** The search-type slices, single source of truth for the picker. */
export const SEARCH_TYPE_OPTIONS: SearchTypeOption[] = (
  Object.keys(SEARCH_TYPE_CAPABILITIES) as GscSearchType[]
).map(value => ({ value, ...SEARCH_TYPE_UI[value] }))

export function getSearchTypeLabel(searchType: GscSearchType): string {
  return SEARCH_TYPE_OPTIONS.find(o => o.value === searchType)?.label ?? searchType
}

/** Brand classification mode for the query-text facet. */
export type BrandMode = '' | 'branded' | 'nonbranded'
/** Question-intent classification mode for the query-text facet. */
export type QuestionMode = '' | 'questions' | 'nonquestions'

// Escape regex metacharacters so a term matches literally inside the `(t1|t2)`
// alternation.
function escapeRegexAlt(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Long brand variants match with optional punctuation between letters, so a
// URL-derived "nuxtseo" still catches "nuxt seo". Short tokens stay bounded.
function brandRegexAlt(term: string): string | null {
  const clean = term.toLowerCase().trim()
  if (!clean)
    return null
  const folded = foldBrandQuery(clean)
  return folded.length >= 4
    ? folded.split('').map(escapeRegexAlt).join('[^a-z0-9]*')
    : `(^|[^a-z0-9])${escapeRegexAlt(clean)}(?=$|[^a-z0-9])`
}

/**
 * Build the brand query-text facet from a mode and the site's brand terms.
 * `branded` matches the canonical query against the alternation; `nonbranded`
 * negates it. Returns `null` when no mode is active or the site has no brand
 * terms, so the unfiltered breakdown shows.
 *
 * The facet targets `queryCanonical` so similar phrasings batch under one
 * match: a `nuxt seo` brand term catches `Nuxt SEO` and `nuxtseo`.
 */
export function buildBrandFacet(mode: BrandMode, terms: readonly string[]): GscFacet | null {
  if (!mode || !terms.length)
    return null
  const variants = [...new Set(normalizeBrandKeywords(terms).flatMap(brandQueryVariants))]
  const pattern = `(${variants.map(brandRegexAlt).filter(Boolean).join('|')})`
  if (pattern === '()')
    return null
  return { column: 'queryCanonical', op: mode === 'branded' ? 'regex' : 'notRegex', value: pattern }
}

/**
 * Question-intent words, anchored at the start of the canonical query. Matches
 * informational "how to", "what is", "why does" style queries. Exported as the
 * single source of truth so a consumer needing the JS-side predicate does not
 * redefine it and drift.
 */
export const QUESTION_REGEX = '^(how|what|why|when|where|who|which|whose|whom|can|could|should|would|will|do|does|did|is|are|was|were|am)\\b'

/** Build the question-intent facet. A sibling of the brand facet. */
export function buildQuestionFacet(mode: QuestionMode): GscFacet | null {
  if (!mode)
    return null
  return { column: 'queryCanonical', op: mode === 'questions' ? 'regex' : 'notRegex', value: QUESTION_REGEX }
}

// Reporting-day labels in a UTC frame, so they do not drift per viewer.
const customLabelFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const customLabelFmtYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function getPeriodLabel(period: Period): string {
  const custom = parseCustomPeriod(period)
  if (custom) {
    const s = parseReportingDay(custom.start)
    const e = parseReportingDay(custom.end)
    const sameYear = s.getUTCFullYear() === e.getUTCFullYear()
    return sameYear
      ? `${customLabelFmt.format(s)} – ${customLabelFmtYear.format(e)}`
      : `${customLabelFmtYear.format(s)} – ${customLabelFmtYear.format(e)}`
  }
  return PERIOD_PRESETS.find(p => p.value === period)?.label ?? period
}
