// Which metric the per-Site Search Console Overview leads with.
//
// Ported from nuxtseo.com's Overview page. Non-web slices (Images, Video,
// News) carry impressions but almost no clicks, so a clicks-led overview shows
// a wall of zeros that reads as broken. On that slice the Overview leads with
// impressions instead. Pure, so the rule is provable without a browser.
import type { GscSearchType } from '@gscdump/contracts'
import type { GscColumn } from '@gscdump/sdk/period-presets'

export interface OverviewLead {
  /** The metric the lists rank by and display. */
  metric: GscColumn
  /** Hero metric order, with impressions first on a clicks-less slice. */
  heroColumns: GscColumn[]
}

export function overviewLead(input: {
  columns: readonly GscColumn[]
  searchType: GscSearchType
  /** Period totals, or nothing while they are unknown. */
  totals: { clicks?: number | null, impressions?: number | null } | null | undefined
}): OverviewLead {
  const { columns, searchType, totals } = input
  const clicksLess = searchType !== 'web'
    && !!totals
    && (totals.clicks ?? 0) === 0
    && (totals.impressions ?? 0) > 0
  const lead = columns[0] ?? 'clicks'
  // Swap a default clicks lead only. An explicit non-clicks choice from the
  // metric toggle stays.
  const metric = lead === 'clicks' && clicksLess ? 'impressions' : lead
  const heroColumns = clicksLess && columns.includes('impressions')
    ? ['impressions' as const, ...columns.filter(c => c !== 'impressions')]
    : [...columns]
  return { metric, heroColumns }
}
