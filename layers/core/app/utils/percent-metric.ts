/**
 * Metric keys whose value is a percentage and must always carry a `%` suffix.
 * CTR used to render as the raw ratio `0.074` on stat cards and as `3.6%` in
 * table cells; routing both through here keeps one unit per metric.
 */
const percentMetricKeys = new Set(['ctr', 'indexedPercent'])

export function isPercentMetric(key: string): boolean {
  return percentMetricKeys.has(key)
}

/**
 * Render a percentage-scaled value, e.g. `3.62` becomes `3.6%`.
 *
 * The input must already be scaled to 0-100. This never guesses the scale,
 * because a 0.4 could be either a 40% ratio or an already-scaled 0.4%.
 */
export function formatPercentMetric(value: number | string, decimals = 1): string {
  const num = Number(value)
  if (!Number.isFinite(num))
    return '—'
  return `${num.toFixed(decimals)}%`
}
