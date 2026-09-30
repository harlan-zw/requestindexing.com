// Pick the rank-1 counterpart for each group key out of one grouped report.
//
// nuxtseo.com resolves a table page's "Top page" / "Top keyword" column in a
// single windowed scan (`ROW_NUMBER() OVER (PARTITION BY ...)` over
// `page_queries`). This app has no arbitrary-SQL operation, so it asks the
// analytics report for the same `(group, counterpart)` breakdown and does the
// partitioning here, on data the caller already holds.
import { dimensionKey } from './canonical-query'

/** Any report row. Fields are read by name, so the row type stays the caller's. */
export type TopAssociationRow = Record<string, unknown>

export interface SelectTopAssociationsOptions {
  /** Row field the table is keyed by, for example `queryCanonical`. */
  groupField: string
  /** Row field whose best value is wanted, for example `page`. */
  topField: string
  /** Row field ranked on. Defaults to `clicks`. */
  metric?: string
}

/**
 * The highest-ranked `topField` per `groupField`, ties broken by first
 * appearance so the answer follows the order the engine ranked the rows in.
 * Rows missing either field, or carrying a non-finite metric, are skipped.
 * A `queryCanonical` group is keyed by its clustering key, the value the
 * association read filtered on, not by the label the report wrote over it.
 */
export function selectTopAssociations(
  rows: readonly TopAssociationRow[],
  { groupField, topField, metric = 'clicks' }: SelectTopAssociationsOptions,
): Map<string, string> {
  const best = new Map<string, { value: string, score: number }>()

  for (const row of rows) {
    const key = dimensionKey(row, groupField)
    const value = row[topField]
    if (!key || typeof value !== 'string' || !value)
      continue

    const score = Number(row[metric] ?? 0)
    const current = best.get(key)
    if (!current || (Number.isFinite(score) && score > current.score))
      best.set(key, { value, score: Number.isFinite(score) ? score : 0 })
  }

  return new Map([...best].map(([key, { value }]) => [key, value]))
}
