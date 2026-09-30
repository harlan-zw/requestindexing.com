// The ranking and matching behind the trend panels. Pure module: no Vue, no
// fetch. `useGscTopEntityTrend` owns the three reads and hands their rows here.
//
// The candidates come from the hosted report, which relabels a canonical query
// with its top raw variant. The daily series come from the rows read, keyed by
// the clustering key. Matching the two on the label drew a top query as a flat
// zero band and moved its traffic into "All Others". Both sides match on
// `dimensionKey`, and only the legend reads the label.
import type { Metric } from 'gscdump/query'
import { dimensionKey } from './canonical-query'

type Row = Record<string, unknown>

/** One named band: the identity the rows read matches on, and the text people read. */
export interface TrendEntity {
  key: string
  label: string
}

/** One entity's value on one day, in the shape `bucketTopEntities` takes. */
export interface TrendDayRow {
  date: string
  key: string
  label: string
  value: number
}

export interface RankTrendEntitiesOptions {
  /** Row field the candidates are keyed by, for example `queryCanonical`. */
  dimension: string
  metric: Metric
  topN: number
  /** Drops a candidate before it can rank, for example a search operator string. */
  exclude?: (label: string) => boolean
}

/** The top N candidates from the ranked breakdown, best first. */
export function rankTrendEntities(rows: readonly Row[], opts: RankTrendEntitiesOptions): TrendEntity[] {
  const ranked = new Map<string, { label: string, value: number }>()
  for (const row of rows) {
    const key = dimensionKey(row, opts.dimension)
    const label = String(row[opts.dimension] ?? '') || key
    if (!key || opts.exclude?.(label))
      continue
    const value = Number(row[opts.metric] ?? 0) || 0
    // The breakdown orders by the metric but never filters on it, so a site
    // with almost no clicks ranks zero-click queries as its top queries and
    // every named band is flat. A zero-valued candidate is not a top entity.
    if (value <= 0 && (opts.metric === 'clicks' || opts.metric === 'impressions'))
      continue
    ranked.set(key, { label, value })
  }
  return [...ranked.entries()]
    .sort((a, b) => opts.metric === 'position' ? a[1].value - b[1].value : b[1].value - a[1].value)
    .slice(0, opts.topN)
    .map(([key, { label }]) => ({ key, label }))
}

/** The named entities' daily values from the rows read. Rows for any other entity are dropped. */
export function trendDayRows(
  rows: readonly Row[],
  opts: { dimension: string, metric: Metric, entities: readonly TrendEntity[] },
): TrendDayRow[] {
  const labels = new Map(opts.entities.map(entity => [entity.key, entity.label]))
  const out: TrendDayRow[] = []
  for (const row of rows) {
    const key = dimensionKey(row, opts.dimension)
    const date = String(row.date ?? '')
    const label = labels.get(key)
    if (!key || !date || label === undefined)
      continue
    out.push({ date, key, label, value: Number(row[opts.metric] ?? 0) || 0 })
  }
  return out
}
