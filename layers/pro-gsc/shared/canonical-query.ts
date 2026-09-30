// A canonical query row carries two strings, and they are not interchangeable.
//
// `queryCanonical` is what the engine groups on: a clustering key that is
// lowercased, singularised, stopword-free and token-sorted, so "cotton tree
// caravan park" groups as "caravan cotton park tree". gscdump's hosted report
// writes the group's top raw variant over that field, because nobody can find
// the key in Search Console, and keeps the key in `queryCanonicalKey`. The rows
// read does no relabelling, so its `queryCanonical` is still the key.
//
// A follow-up read that filters on `queryCanonical` compares against the key.
// Sent the display label instead, it matches nothing for every term whose label
// and key differ. So the label is for people and the key is for reads.
//
// Pure module: no Vue, no fetch.

/** Any row that may carry a canonical query. Fields are untrusted. */
export interface CanonicalQueryRow {
  queryCanonical?: unknown
  queryCanonicalKey?: unknown
}

/**
 * The clustering key a follow-up read must filter on: the sparkline and
 * position series, the variant breakdown, the top page, the trend bands.
 * Empty when the row has no canonical query.
 */
export function canonicalQueryKey(row: CanonicalQueryRow): string {
  if (typeof row.queryCanonicalKey === 'string' && row.queryCanonicalKey)
    return row.queryCanonicalKey
  return typeof row.queryCanonical === 'string' ? row.queryCanonical : ''
}

/**
 * A row's identity under one dimension, so a report row and a rows read of the
 * same group match. Only `queryCanonical` has a label that differs from its key.
 */
export function dimensionKey(row: Record<string, unknown>, dimension: string): string {
  if (dimension === 'queryCanonical')
    return canonicalQueryKey(row)
  const value = row[dimension]
  return typeof value === 'string' ? value : ''
}
