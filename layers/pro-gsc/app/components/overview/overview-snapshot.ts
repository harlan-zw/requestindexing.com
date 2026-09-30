import { periodToDateRange } from '@gscdump/sdk/period'

// The dashboard home's Search Console band, as pure data.
//
// Ported from gscdump.com's `overview-snapshot-cards.ts` and the reads inside
// `AppOverviewSnapshot.vue`. Two things differ. The band reads one fixed
// window, the last 28 stable days against the 28 before, because this app has
// no range picker on the home. And every number comes from ONE daily read per
// Site that also draws that Site's 90-day clicks run, so the home costs one
// Search Console request per Site. Clicks and impressions sum by day, and
// position weights by each day's impressions, so a window cut from the daily
// rows equals the total the report would return for it.

/** The 90-day run a Sites-column row draws. */
export const OVERVIEW_SPARK_DAYS = 90

/** The band's window and the comparison window before it. Inclusive `YYYY-MM-DD`. */
export interface OverviewWindow {
  start: string
  end: string
  prevStart: string
  prevEnd: string
}

/** What the home fetches per Site: one daily read that covers every window. */
export interface OverviewReadRange {
  window: OverviewWindow
  /** First day of the daily read, `OVERVIEW_SPARK_DAYS` before `end`. */
  start: string
  end: string
}

/** One day of a Site's Search Console totals. */
export interface OverviewDay {
  date: string
  clicks: number
  impressions: number
  position: number
}

/** A Site's indexing summary, as the band reads it. */
export interface OverviewIndexing {
  indexedPercent: number
  notIndexed: number
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The home's read range. The window ends on the last stable Search Console
 * day, so the newest, still-filling days never read as a drop.
 */
export function overviewReadRange(now?: Date): OverviewReadRange {
  const range = periodToDateRange('28d', now ? { now } : undefined)
  return {
    window: { start: range.start, end: range.end, prevStart: range.prevStart, prevEnd: range.prevEnd },
    start: shiftDay(range.end, -(OVERVIEW_SPARK_DAYS - 1)),
    end: range.end,
  }
}

function inRange<T extends { date: string }>(rows: readonly T[], start: string, end: string): T[] {
  return rows.filter(row => row.date >= start && row.date <= end)
}

/**
 * One Site's clicks over the band's window, and its daily clicks run over the
 * whole read. Search Console omits a day with no impressions, so the run fills
 * those days with zero rather than closing the gap.
 */
export function overviewSiteClicks(daily: readonly OverviewDay[], range: OverviewReadRange): { clicks: number, clicksSpark: number[] } {
  const byDate = new Map(daily.map(day => [day.date, day.clicks]))
  const clicksSpark: number[] = []
  for (let date = range.start; date <= range.end; date = shiftDay(date, 1))
    clicksSpark.push(byDate.get(date) ?? 0)
  const clicks = inRange(daily, range.window.start, range.window.end).reduce((sum, day) => sum + day.clicks, 0)
  return { clicks, clicksSpark }
}

/** One Site's input to the band. `null` means the read has no value for it. */
export interface OverviewSnapshotSite {
  label: string
  daily: readonly OverviewDay[] | null
  indexing: OverviewIndexing | null
}

export type OverviewSnapshotCard
  = | { key: 'clicks' | 'impressions', total: number, deltaPercent: number | null, spark: number[] }
    | { key: 'ctr', percent: number, deltaPoints: number | null, spark: number[] }
    | { key: 'position', value: number, delta: number | null, spark: number[] }
    | { key: 'indexed', averagePercent: number, bars: Array<{ label: string, percent: number }> }
    | { key: 'not-indexed', total: number }

export type OverviewSnapshotKey = OverviewSnapshotCard['key']

export interface OverviewSnapshotCardMeta {
  label: string
  hint: string
  /** The fleet route that owns the number, or null when there is none. */
  to: string | null
}

export const OVERVIEW_SNAPSHOT_META: Record<OverviewSnapshotKey, OverviewSnapshotCardMeta> = {
  'clicks': { label: 'Clicks', hint: 'Organic clicks from Google Search over the last 28 days.', to: null },
  'impressions': { label: 'Impressions', hint: 'Times a page appeared in Google results over the last 28 days.', to: null },
  'ctr': { label: 'CTR', hint: 'Clicks per impression over the last 28 days.', to: null },
  'position': { label: 'Avg position', hint: 'Impressions-weighted average rank over the last 28 days.', to: null },
  'indexed': { label: 'Indexed', hint: 'Share of known pages Google has indexed, averaged across Sites.', to: '/pro/dashboard/web-indexing' },
  'not-indexed': { label: 'Not indexed', hint: 'Known URLs Google has not indexed. Excludes URLs still pending a decision.', to: '/pro/dashboard/web-indexing' },
}

/** Signed percentage change between two window totals, rounded, or null. */
export function snapshotDeltaPercent(total: number, prevTotal: number | null): number | null {
  if (prevTotal == null || prevTotal <= 0)
    return null
  const pct = Math.round(((total - prevTotal) / prevTotal) * 100)
  return pct === 0 || Math.abs(pct) > 999 ? null : pct
}

/** A change smaller than one decimal place reads as noise, so it is not shown. */
function visibleChange(change: number): number | null {
  return Math.abs(change) >= 0.1 ? change : null
}

interface FleetDay { date: string, clicks: number, impressions: number, weightedPosition: number, weight: number }

/** Every Site's rows merged by date, oldest first. */
function mergeDays(sites: readonly OverviewSnapshotSite[]): FleetDay[] {
  const byDate = new Map<string, FleetDay>()
  for (const site of sites) {
    for (const day of site.daily ?? []) {
      const row = byDate.get(day.date) ?? { date: day.date, clicks: 0, impressions: 0, weightedPosition: 0, weight: 0 }
      row.clicks += day.clicks
      row.impressions += day.impressions
      if (day.position > 0) {
        const weight = Math.max(day.impressions, 1)
        row.weightedPosition += day.position * weight
        row.weight += weight
      }
      byDate.set(day.date, row)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** A run of one or two flat zero points is a dot, not a trend. */
function sparkOf(values: number[]): number[] {
  return values.length >= 2 && values.some(value => value > 0) ? values : []
}

function totals(days: readonly FleetDay[]) {
  return days.reduce(
    (acc, day) => ({
      clicks: acc.clicks + day.clicks,
      impressions: acc.impressions + day.impressions,
      weightedPosition: acc.weightedPosition + day.weightedPosition,
      weight: acc.weight + day.weight,
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0, weight: 0 },
  )
}

/**
 * The band's cards, in their fixed order, each only when a Site answers it.
 *
 * A card with no data drops out rather than rendering a dash. A delta needs
 * rows in the comparison window: a fleet whose history starts inside the
 * window gets the number and no change, never an inferred one.
 */
export function overviewSnapshotCards(sites: readonly OverviewSnapshotSite[], window: OverviewWindow): OverviewSnapshotCard[] {
  const cards: OverviewSnapshotCard[] = []
  const days = mergeDays(sites)
  const current = inRange(days, window.start, window.end)
  const previous = inRange(days, window.prevStart, window.prevEnd)
  const cur = totals(current)
  const prev = previous.length ? totals(previous) : null

  if (sites.some(site => site.daily !== null)) {
    cards.push(
      { key: 'clicks', total: cur.clicks, deltaPercent: snapshotDeltaPercent(cur.clicks, prev?.clicks ?? null), spark: sparkOf(current.map(day => day.clicks)) },
      { key: 'impressions', total: cur.impressions, deltaPercent: snapshotDeltaPercent(cur.impressions, prev?.impressions ?? null), spark: sparkOf(current.map(day => day.impressions)) },
    )
    if (cur.impressions > 0) {
      const percent = (cur.clicks / cur.impressions) * 100
      const prevPercent = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : null
      cards.push({
        key: 'ctr',
        percent,
        deltaPoints: prevPercent == null ? null : visibleChange(percent - prevPercent),
        spark: sparkOf(current.map(day => day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0)),
      })
    }
    if (cur.weight > 0) {
      const value = cur.weightedPosition / cur.weight
      const prevValue = prev && prev.weight > 0 ? prev.weightedPosition / prev.weight : null
      const positions = current.filter(day => day.weight > 0).map(day => day.weightedPosition / day.weight)
      cards.push({
        key: 'position',
        value,
        delta: prevValue == null ? null : visibleChange(value - prevValue),
        spark: positions.length >= 2 ? positions : [],
      })
    }
  }

  const indexed = sites
    .filter((site): site is OverviewSnapshotSite & { indexing: OverviewIndexing } => site.indexing !== null)
    .map(site => ({ label: site.label, percent: site.indexing.indexedPercent, notIndexed: site.indexing.notIndexed }))
  if (indexed.length) {
    cards.push(
      {
        key: 'indexed',
        averagePercent: indexed.reduce((sum, site) => sum + site.percent, 0) / indexed.length,
        bars: indexed.map(({ label, percent }) => ({ label, percent })).sort((a, b) => b.percent - a.percent),
      },
      { key: 'not-indexed', total: indexed.reduce((sum, site) => sum + site.notIndexed, 0) },
    )
  }
  return cards
}
