import { semanticColors } from './semanticColors'

/**
 * Data-viz palette — chart-only colours, distinct from semantic status colours.
 *
 * Hex literals (rather than `var(--ui-color-*)`) because Unovis / SVG / Canvas
 * cannot resolve CSS variables at render time without an extra read, and
 * `color-mix()` consumers need stable string inputs.
 *
 * Three concerns:
 *  1. Metric identity — each GSC / CWV metric has a fixed colour so multi-series
 *     charts are readable at a glance (clicks = emerald, impressions = blue, …).
 *  2. Category palettes — ordered swatches for series with no inherent identity
 *     (top pages, country donut, device split).
 *  3. Threshold / brand splits — colours that carry meaning (brand vs non-brand
 *     traffic, indexing success vs error).
 *
 * Colour MUST encode information; never decorate. Routed through `vizColorMap`
 * so legend chips and sparklines share one lookup.
 */

export interface VizColor {
  bg: string
  hex: string
  text: string
  dot: string
}

/**
 * `dot` is the solid identity colour (legend dots, sparkline strokes); `bg` is its
 * translucent fill variant for proportion bars / badge backgrounds so the value sitting
 * on top stays readable. Standard `bg-{hue}-{shade}` tokens get a `/15` fill; tokens that
 * already carry an opacity modifier or use a semantic name (e.g. `bg-accented`) pass through.
 *
 * The `/15` variants are built at runtime, so Tailwind's content scanner never sees them
 * as literals — they must be safelisted (see `vizFillSafelist` below) or the bar renders
 * transparent.
 */
function viz(dot: string, hex: string, text: string): VizColor {
  const bg = /^bg-[a-z]+-\d+$/.test(dot) ? `${dot}/15` : dot
  return { bg, hex, text, dot }
}

/**
 * Tailwind JIT safelist. Every `bg-<hue>-<shade>/15` fill `viz()` can emit must appear
 * here as a literal so Tailwind's source scanner generates the CSS (clicks/impressions
 * worked only because `periodVizColors` happened to spell them out). Keep in sync with
 * the `viz()` inputs below — a missing entry makes that metric's proportion bar invisible.
 */
export const vizFillSafelist = [
  'bg-blue-500/15',
  'bg-emerald-500/15',
  'bg-orange-500/15',
  'bg-cyan-500/15',
  'bg-amber-500/15',
  'bg-red-500/15',
  'bg-lime-500/15',
  'bg-olive-500/15',
  'bg-blue-400/15',
  'bg-green-400/15',
  'bg-amber-400/15',
  'bg-emerald-400/15',
  'bg-pink-500/15',
  'bg-sky-400/15',
  'bg-teal-400/15',
  'bg-rose-400/15',
] as const

/**
 * GSC metric identity — pinned so every clicks chart reads emerald, every
 *  impressions chart reads blue, regardless of consumer.
 *
 * Verdant assignment: clicks take the emerald primary because a click is the
 * outcome the product sells. Impressions take the sanctioned blue info accent
 * (exposure, not a win). CTR takes the amber warning accent, position the
 * orange shoulder. No violet: DESIGN.md's palette has no purple in it.
 */
export const gscMetricColors = {
  clicks: viz('bg-emerald-500', '#10b981', 'text-emerald-500'),
  impressions: viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  ctr: viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
  position: viz('bg-orange-500', '#f97316', 'text-orange-500'),
} as const satisfies Record<string, VizColor>

/**
 * Web Analytics metric identity (ADR-0032). Paired with `text` / `dot` tailwind
 * classes because the consumers (`ProCardAnalytics`) bind these via `:class`,
 * whereas the chart line/area colours live inline next to the SVG gradients
 * in `ProGraphAnalytics`.
 */
export const analyticsMetricColors = {
  sessions: viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  users: viz('bg-cyan-500', '#06b6d4', 'text-cyan-500'),
  pageviews: viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
} as const satisfies Record<string, VizColor>

/**
 * Core Web Vitals metric identity. `tbt` (synthetic lab) shares INP's amber —
 *  it occupies the same responsiveness slot when the source is Lighthouse.
 */
export const cwvMetricColors = {
  lcp: viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  inp: viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
  tbt: viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
  cls: viz('bg-emerald-500', '#10b981', 'text-emerald-500'),
} as const satisfies Record<string, VizColor>

/**
 * Period-comparison palette — current period vs comparison (prev/YoY) shown in
 * the date-range picker, sparklines, and any "vs" pill. Pinned so all comparison
 * surfaces share one hue.
 */
export const periodVizColors = {
  current: viz('bg-blue-500/15', '#3b82f6', 'text-blue-600 dark:text-blue-400'),
  // Olive, not a hue of its own: the comparison trail is context behind the
  // current series, so it reads as the neutral earth of the Verdant palette.
  // `#898a54` sits between olive-400 and olive-500 and clears 3:1 against both
  // the light (3.3:1) and the dark (5.0:1) page ground.
  comparison: viz('bg-olive-500/15', '#898a54', 'text-olive-700 dark:text-olive-300'),
} as const satisfies Record<string, VizColor>

/** Indexing status — bridges semantic status into the chart palette. */
export const indexingVizColors = {
  indexed: { bg: 'bg-success', hex: semanticColors.success.hex, text: 'text-success', dot: 'bg-success' },
  notIndexed: { bg: 'bg-warning', hex: semanticColors.warning.hex, text: 'text-warning', dot: 'bg-warning' },
  excluded: { bg: 'bg-warning', hex: semanticColors.warning.hex, text: 'text-warning', dot: 'bg-warning' },
  errors: { bg: 'bg-error', hex: semanticColors.error.hex, text: 'text-error', dot: 'bg-error' },
  error: { bg: 'bg-error', hex: semanticColors.error.hex, text: 'text-error', dot: 'bg-error' },
  crawled: { bg: 'bg-info', hex: semanticColors.info.hex, text: 'text-info', dot: 'bg-info' },
} as const satisfies Record<string, VizColor>

/**
 * Position-distribution tiers — premier (1–3) reads warning-amber so the eye
 *  goes there; second-page / beyond fade into muted neutrals.
 */
export const positionDistColors = {
  premier: { bg: 'bg-warning', hex: semanticColors.warning.hex, text: 'text-warning', dot: 'bg-warning' },
  pageOne: { bg: 'bg-info', hex: semanticColors.info.hex, text: 'text-info', dot: 'bg-info' },
  secondPage: { bg: 'bg-muted', hex: semanticColors.neutral.hex, text: 'text-muted', dot: 'bg-muted' },
  beyond: { bg: 'bg-elevated', hex: semanticColors.neutral.hex, text: 'text-muted', dot: 'bg-elevated' },
  top3: { bg: 'bg-warning', hex: semanticColors.warning.hex, text: 'text-warning', dot: 'bg-warning' },
  page1: { bg: 'bg-info', hex: semanticColors.info.hex, text: 'text-info', dot: 'bg-info' },
  page2: { bg: 'bg-muted', hex: semanticColors.neutral.hex, text: 'text-muted', dot: 'bg-muted' },
  deep: { bg: 'bg-elevated', hex: semanticColors.neutral.hex, text: 'text-muted', dot: 'bg-elevated' },
} as const satisfies Record<string, VizColor>

/**
 * Device split — desktop / mobile / tablet. Lighter shoulder hues so three
 *  values can sit beside each other without one dominating.
 */
export const gscDeviceColors = {
  desktop: viz('bg-blue-400', '#60a5fa', 'text-blue-400'),
  mobile: viz('bg-green-400', '#4ade80', 'text-green-400'),
  tablet: viz('bg-amber-400', '#fbbf24', 'text-amber-400'),
} as const satisfies Record<string, VizColor>

/**
 * Brand vs non-brand traffic split. Amber marks the traffic your name already
 *  owns, emerald reads as "earned" non-brand traffic.
 */
export const gscBrandSplitColors = {
  brand: viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
  nonBrand: viz('bg-emerald-500', '#10b981', 'text-emerald-500'),
} as const satisfies Record<'brand' | 'nonBrand', VizColor>

/**
 * Top-entity stacked trend (`UiTopEntityStackChart`): 10 identity hues, ranked
 * by entity rank, plus the neutral "Other" residual in the last slot. Every
 * current caller tracks the top 5; the spare hues keep a wider caller safe. The
 * first five hues are the ones `gscTopPagesColors` uses, so a page and a query
 * of the same rank read alike.
 */
export const gscTopEntityColors: VizColor[] = [
  viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  viz('bg-lime-500', '#84cc16', 'text-lime-500'),
  viz('bg-emerald-400', '#34d399', 'text-emerald-400'),
  viz('bg-orange-500', '#f97316', 'text-orange-500'),
  viz('bg-cyan-500', '#06b6d4', 'text-cyan-500'),
  viz('bg-pink-500', '#ec4899', 'text-pink-500'),
  viz('bg-amber-400', '#fbbf24', 'text-amber-400'),
  viz('bg-sky-400', '#38bdf8', 'text-sky-400'),
  viz('bg-teal-400', '#2dd4bf', 'text-teal-400'),
  viz('bg-rose-400', '#fb7185', 'text-rose-400'),
  viz('bg-accented', `${semanticColors.neutral.hex}80`, 'text-muted'),
]

/** Generic five-slot categorical palette for compact composition charts. */
export const categoricalVizColors: string[] = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#22d3ee']
/** Country donut uses the shared categorical palette. */
export const gscCountryDonutColors = categoricalVizColors

/** Top-pages stacked area (6 slots: 5 pages + "other"). */
export const gscTopPagesColors: VizColor[] = [
  viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  viz('bg-lime-500', '#84cc16', 'text-lime-500'),
  viz('bg-emerald-400', '#34d399', 'text-emerald-400'),
  viz('bg-orange-500', '#f97316', 'text-orange-500'),
  viz('bg-cyan-500', '#06b6d4', 'text-cyan-500'),
  viz('bg-accented', `${semanticColors.neutral.hex}80`, 'text-muted'),
]

/**
 * Generic preset swatches — for charts with no metric/category mapping (e.g.
 *  `<UiSparkline color="blue">`). Use a metric/category map first when one fits.
 *
 * `long-tail` / `high-volume` / `quick-wins` are keyword-research categories
 *  consumed by `ProToolsKeywordTable`; aliased onto preset hues so they share
 *  the same look as the underlying chart colour.
 */
export const presetVizColors = {
  'blue': viz('bg-blue-500', '#3b82f6', 'text-blue-500'),
  'green': viz('bg-emerald-500', '#10b981', 'text-emerald-500'),
  'lime': viz('bg-lime-500', '#84cc16', 'text-lime-500'),
  'orange': viz('bg-orange-500', '#f97316', 'text-orange-500'),
  'red': viz('bg-red-500', '#ef4444', 'text-red-500'),
  'cyan': viz('bg-cyan-500', '#06b6d4', 'text-cyan-500'),
  'amber': viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
  'neutral': viz('bg-accented', semanticColors.neutral.hex, 'text-muted'),
  'long-tail': viz('bg-cyan-500', '#06b6d4', 'text-cyan-500'),
  'high-volume': viz('bg-emerald-500', '#10b981', 'text-emerald-500'),
  'quick-wins': viz('bg-amber-500', '#f59e0b', 'text-amber-500'),
} as const satisfies Record<string, VizColor>

/**
 * One lookup for legends, sparklines, and dot chips. Metric / category names
 *  resolve to their identity colour; preset names fall through.
 */
export const vizColorMap: Record<string, VizColor> = {
  ...presetVizColors,
  clicks: gscMetricColors.clicks,
  impressions: gscMetricColors.impressions,
  ctr: gscMetricColors.ctr,
  position: gscMetricColors.position,
  lcp: cwvMetricColors.lcp,
  inp: cwvMetricColors.inp,
  cls: cwvMetricColors.cls,
  brand: gscBrandSplitColors.brand,
  nonBrand: gscBrandSplitColors.nonBrand,
}

/**
 * Lookup helpers. Both function-callable (`vizBgColor("clicks")`) AND
 * key-indexable (`vizBgColor.blue`) so legend mapping and inline class
 * binding can share one import.
 */
function makeLookup(field: keyof VizColor) {
  const fallback = presetVizColors.neutral[field]
  return Object.assign(
    (name: string | null | undefined) => (name ? (vizColorMap[name]?.[field] ?? fallback) : fallback),
    Object.fromEntries(Object.entries(vizColorMap).map(([k, v]) => [k, v[field]])),
  ) as ((name: string | null | undefined) => string) & Record<string, string>
}

export const vizBgColor = makeLookup('bg')
export const vizDotColor = makeLookup('hex')
export const vizTextColor = makeLookup('text')

/* ── Request Indexing additions ───────────────────────────────────────────────
   No nuxtseo.com equivalent. Keep below the shared block so the rest of this
   file stays a clean resync. */

/** Query breadth (how many distinct queries a page wins). */
export const breadthVizColor = { dot: 'bg-lime-500', bg: 'bg-lime-500/60', text: 'text-lime-600 dark:text-lime-400', hex: '#84cc16' } as const satisfies VizColor

/** Brand-term marker on a query label. */
export const brandVizColor = { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', hex: '#f59e0b' } as const satisfies VizColor
