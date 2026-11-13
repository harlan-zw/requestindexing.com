import type { SitemapChangesCompleteness } from '@gscdump/contracts'

// Pure window math for the Indexing → Sitemaps hero card (B7).
//
// The hero "URLs" stat used to show a net-positive trend chip ("+8") at the same
// time as a "significant URL removal — 140 URLs (95%)" alert, because the two
// numbers were computed against different denominators. These helpers give both
// the alert and the trend-chip suppression a single, consistent baseline: the
// total at the START of the window.

export interface SitemapWindowChange {
  totalAdded: number
  totalRemoved: number
}

export interface SitemapRemovalAlert {
  pct: number
  active: boolean
}

export type SitemapChangeCoverageView
  = | {
    _tag: 'complete'
    summary: string
    emptyText: string
    tooltipTitle: string
    tooltipDescription: string
  }
  | {
    _tag: 'truncated'
    summary: string
    emptyText: string
    tooltipTitle: string
    tooltipDescription: string
    alertDescription: string
  }

function coverageSummary(noun: 'matched URLs' | 'retained URLs', matched: number, visible: number): string {
  return matched > visible
    ? `Showing ${visible.toLocaleString()} of ${matched.toLocaleString()} ${noun}`
    : `${visible.toLocaleString()} ${noun}`
}

function retainedCapDescription(completeness: Extract<SitemapChangesCompleteness, { _tag: 'truncated' }>): string {
  const additionsCapped = completeness.reasons.includes('added_limit')
  const removalsCapped = completeness.reasons.includes('removed_limit')
  if (additionsCapped && removalsCapped) {
    return `retained additions are capped at ${completeness.limits.added.toLocaleString()} and removals at ${completeness.limits.removed.toLocaleString()}`
  }
  if (additionsCapped)
    return `retained additions are capped at ${completeness.limits.added.toLocaleString()}`
  return `retained removals are capped at ${completeness.limits.removed.toLocaleString()}`
}

export function sitemapChangeCoverageView(
  completeness: SitemapChangesCompleteness,
  rows: { matched: number, visible: number },
): SitemapChangeCoverageView {
  const scanned = completeness.scannedUrls.toLocaleString()
  if (completeness._tag === 'complete') {
    return {
      _tag: 'complete',
      summary: coverageSummary('matched URLs', rows.matched, rows.visible),
      emptyText: 'No recent changes for this sitemap in this period.',
      tooltipTitle: 'Complete change feed',
      tooltipDescription: `${scanned} URLs scanned. All matching additions and removals are retained.`,
    }
  }

  const alertDescription = completeness.reasons.includes('scan_limit')
    ? `${scanned} URLs scanned. The scan limit was reached, so change totals and retained rows may be lower than actual.`
    : `${scanned} URLs scanned. Change totals are complete; ${retainedCapDescription(completeness)}.`
  return {
    _tag: 'truncated',
    summary: coverageSummary('retained URLs', rows.matched, rows.visible),
    emptyText: 'No matching changes are present in the retained rows.',
    tooltipTitle: 'Partial change feed',
    tooltipDescription: alertDescription,
    alertDescription,
  }
}

/** Net add/remove over the window. */
export function sitemapNetChange(c: SitemapWindowChange | null | undefined): number {
  if (!c)
    return 0
  return (c.totalAdded ?? 0) - (c.totalRemoved ?? 0)
}

/**
 * Total at the START of the window = current − net = current + removed − added.
 * When that collapses to <= 0 (e.g. a near-total churn where adds re-inflate the
 * current total), fall back to `removed + current` so a full collapse still
 * yields a meaningful baseline.
 */
export function sitemapPriorTotal(currentTotalUrls: number, c: SitemapWindowChange | null | undefined): number {
  const removed = c?.totalRemoved ?? 0
  const raw = currentTotalUrls + removed - (c?.totalAdded ?? 0)
  if (raw <= 0)
    return removed + currentTotalUrls
  return raw
}

/**
 * Removal alert measured against the prior baseline. `active` (pct >= 10 with at
 * least one removal) gates BOTH the alert AND the hero trend-chip suppression.
 */
export function sitemapRemovalAlert(currentTotalUrls: number, c: SitemapWindowChange | null | undefined): SitemapRemovalAlert {
  const removed = c?.totalRemoved ?? 0
  if (removed <= 0)
    return { pct: 0, active: false }
  const baseline = sitemapPriorTotal(currentTotalUrls, c)
  const pct = baseline > 0 ? Math.round((removed / baseline) * 100) : 0
  return { pct, active: pct >= 10 }
}
