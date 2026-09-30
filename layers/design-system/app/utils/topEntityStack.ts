// Shared "top N + Other" stacked-trend bucketing — pure, dependency-free logic
// backing `UiTopEntityStackChart`. Used for the search-console Queries / Pages
// / Countries trend charts (manual-review-2026-08): pick the top N entities by
// total value over the range, zero-fill each against the full date axis (an
// entity absent on a given day reads as a zero band, never a gap), roll
// everything else into a single "Other" band, and coarsen the date axis into
// a bounded number of buckets so a wide range doesn't render one bar per day.
//
// "Other" has two modes:
//  - `totals` supplied (the caller only fetched the top-K candidates, not the
//    full entity universe): Other = total - sum(top N). This is the common
//    case — GSC queries/pages have far more than 5 distinct values.
//  - `totals` omitted (the caller supplied every candidate, e.g. a bounded
//    dimension like country): Other = sum of every candidate beyond top N.

const EPSILON = 1e-9

export interface TopEntityDayRow {
  /** ISO `YYYY-MM-DD` day. */
  date: string
  /** Stable entity identity (query text, page path, country code). */
  key: string
  /** Display label. Defaults to `key` when omitted at the call site. */
  label: string
  /** Metric value for this entity on this day (already the selected metric). */
  value: number
}

export interface TopEntityStackBucket {
  /** First day folded into this bucket. */
  start: string
  /** Last day folded into this bucket. */
  end: string
}

export interface TopEntityStackSeries {
  key: string
  label: string
  /** One value per bucket, aligned to `result.buckets`. */
  values: number[]
  isOther: boolean
}

export interface TopEntityStackResult {
  buckets: TopEntityStackBucket[]
  series: TopEntityStackSeries[]
}

export interface BucketTopEntitiesOptions {
  /** Full canonical date axis, ascending, no gaps — the zero-fill target. */
  dates: string[]
  /** Sparse per-entity-per-day rows. A missing (entity, date) pair is 0. */
  rows: TopEntityDayRow[]
  /** How many entities stay explicit. Default 5. */
  topN?: number
  /** Site/aggregate total per date, aligned to `dates`. Drives Other = total - topN. */
  totals?: number[]
  /** Cap on rendered date buckets (adjacent days are summed together). Default 10. */
  maxBuckets?: number
  otherLabel?: string
  /** Drop a candidate entirely before ranking/rolling it into Other — e.g. `isSearchOperatorQuery`. */
  excludeKey?: (key: string) => boolean
}

export function bucketTopEntities(opts: BucketTopEntitiesOptions): TopEntityStackResult {
  const { dates, rows, topN = 5, totals, maxBuckets = 10, otherLabel = 'All Others', excludeKey } = opts
  if (!dates.length)
    return { buckets: [], series: [] }

  const dateIndex = new Map(dates.map((d, i) => [d, i]))
  const filteredRows = excludeKey ? rows.filter(r => !excludeKey(r.key)) : rows

  const byKey = new Map<string, { label: string, values: number[] }>()
  for (const row of filteredRows) {
    const idx = dateIndex.get(row.date)
    if (idx == null)
      continue
    let entry = byKey.get(row.key)
    if (!entry) {
      entry = { label: row.label || row.key, values: Array.from({ length: dates.length }).fill(0) as number[] }
      byKey.set(row.key, entry)
    }
    entry.values[idx] = (entry.values[idx] ?? 0) + row.value
  }

  const ranked = Array.from(byKey.entries(), ([key, entry]) => ({
    key,
    label: entry.label,
    values: entry.values,
    total: entry.values.reduce((sum, v) => sum + v, 0),
  }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))

  const top = ranked.slice(0, topN)
  const rest = ranked.slice(topN)

  const otherValues = dates.map((_, i) => {
    if (totals) {
      const topSum = top.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
      return Math.max(0, (totals[i] ?? 0) - topSum)
    }
    return rest.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)
  })
  const hasOther = otherValues.some(v => v > EPSILON)

  const daily: TopEntityStackSeries[] = top.map(s => ({
    key: s.key,
    label: s.label,
    values: s.values,
    isOther: false,
  }))
  if (hasOther) {
    daily.push({
      key: '__other__',
      label: otherLabel,
      values: otherValues,
      isOther: true,
    })
  }

  // Coarsen the date axis: fold contiguous day-groups into one bucket per
  // series (summed), bounded to `maxBuckets`.
  const bucketCount = Math.max(1, Math.min(maxBuckets, dates.length))
  const groupSize = Math.ceil(dates.length / bucketCount)
  const buckets: TopEntityStackBucket[] = []
  const bucketedSeries: TopEntityStackSeries[] = daily.map(s => ({ ...s, values: [] }))

  for (let start = 0; start < dates.length; start += groupSize) {
    const end = Math.min(start + groupSize, dates.length)
    buckets.push({ start: dates[start]!, end: dates[end - 1]! })
    daily.forEach((s, si) => {
      let sum = 0
      for (let i = start; i < end; i++) sum += s.values[i] ?? 0
      bucketedSeries[si]!.values.push(sum)
    })
  }

  return { buckets, series: bucketedSeries }
}

export interface TopEntityStackRow {
  i: number
  values: number[]
  shares: number[]
  total: number
}

/** Preserve counts for details and express each plotted bucket as a percentage. */
export function topEntityStackRows({ buckets, series }: TopEntityStackResult): TopEntityStackRow[] {
  return buckets.map((_, i) => {
    const values = series.map(s => s.values[i] ?? 0)
    const total = values.reduce((sum, value) => sum + value, 0)
    return { i, values, shares: values.map(value => total > 0 ? value / total * 100 : 0), total }
  })
}

/** Project the full reporting-day axis onto the chart's bucket domain. */
export function topEntityStackTimeline(buckets: TopEntityStackBucket[]): { dates: string[], positions: number[] } {
  const dates: string[] = []
  for (const bucket of buckets) {
    const start = Date.parse(`${bucket.start}T00:00:00Z`)
    const end = Date.parse(`${bucket.end}T00:00:00Z`)
    for (let day = start; day <= end; day += 86_400_000)
      dates.push(new Date(day).toISOString().slice(0, 10))
  }
  // Match the Overview's first-to-last-day axis, including a shorter final bucket.
  const positions = dates.map((_, i) => dates.length === 1 ? 0 : i / (dates.length - 1) * buckets.length - 0.5)
  return { dates, positions }
}
