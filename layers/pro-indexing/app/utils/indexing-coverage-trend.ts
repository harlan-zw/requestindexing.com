// Historical indexed counts behind the coverage chart.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/utils/indexing-coverage-trend.ts`.
//
// The read's totalUrls may count submitted sitemap URLs or inspection rows.
// It cannot establish an inspected denominator. Only indexedCount has a stable
// meaning. One valid point is not a trend, so the chart waits for two.

export interface IndexingCoverageTrendSourcePoint {
  date: string
  indexedCount: number | null
}

export interface IndexingCoverageTrendPoint extends Record<string, unknown> {
  date: string
  indexed: number
}

export type IndexingCoverageTrend
  = | { _tag: 'insufficient', validPoints: number }
    | { _tag: 'ready', points: IndexingCoverageTrendPoint[], latest: IndexingCoverageTrendPoint }

export type IndexingCoverageTrendViewState
  = | { _tag: 'loading' }
    | { _tag: 'error' }
    | { _tag: 'loaded', trend: IndexingCoverageTrend }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatIndexingCoverageDate(raw: unknown): string {
  const date = new Date(String(raw))
  if (Number.isNaN(date.getTime()))
    return String(raw)
  const month = MONTHS[date.getUTCMonth()]
  if (!month)
    return String(raw)
  return `${date.getUTCDate()} ${month}`
}

function parsePoint(source: IndexingCoverageTrendSourcePoint): IndexingCoverageTrendPoint | null {
  const date = source.date.trim()
  const indexed = source.indexedCount
  if (
    !date
    || indexed == null
    || !Number.isSafeInteger(indexed)
    || indexed < 0
  ) {
    return null
  }
  return { date, indexed }
}

export function buildIndexingCoverageTrend(
  source: ReadonlyArray<IndexingCoverageTrendSourcePoint>,
): IndexingCoverageTrend {
  const pointsByDate = new Map<string, IndexingCoverageTrendPoint>()
  for (const row of source) {
    const point = parsePoint(row)
    if (point)
      pointsByDate.set(point.date, point)
  }

  const points = [...pointsByDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))

  const latest = points.at(-1)
  if (points.length < 2 || !latest)
    return { _tag: 'insufficient', validPoints: points.length }

  return { _tag: 'ready', points, latest }
}
