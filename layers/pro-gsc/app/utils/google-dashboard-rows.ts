import type { AnalyticsRowsV1Request } from '@gscdump/contracts/v1/http'
import type { GoogleSearchSlice } from './google-search-slice'
import { sparklineDateAxis } from '../../shared/utils/gsc-series'
import { buildGoogleRowsRequest } from './google-search-slice'

type Row = Record<string, string | number | null>
type RequestOptions = Parameters<typeof buildGoogleRowsRequest>[1]
export type GoogleRowsReader = (body: AnalyticsRowsV1Request) => Promise<readonly Record<string, unknown>[]>

export function googleMetricTotals(rows: readonly Row[]) {
  let weightedPosition = 0
  let clicks = 0
  let impressions = 0
  for (const row of rows) {
    const rowImpressions = Number(row.impressions ?? 0)
    clicks += Number(row.clicks ?? 0)
    impressions += rowImpressions
    weightedPosition += Number(row.position ?? 0) * rowImpressions
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : 0,
  }
}

export function googleDimension(dimension: string): NonNullable<AnalyticsRowsV1Request['dimensions']>[number] {
  return (dimension === 'queryCanonical' ? 'query' : dimension) as NonNullable<AnalyticsRowsV1Request['dimensions']>[number]
}

export function googleRowFilters(
  slice: GoogleSearchSlice,
  facets: readonly { column: string, op: 'eq' | 'regex' | 'notRegex', value: string }[],
): NonNullable<RequestOptions['filters']> {
  return facets.flatMap(({ column, op, value }) => {
    const dimension = googleDimension(column)
    // A detail pin must never disappear when classification rejects it.
    if (slice.googleBrand && dimension === 'query')
      googleEntityFilter(slice, column, value)
    // Country and device are already applied as lists in this request.
    if ((dimension === 'country' && slice.countries.length)
      || (dimension === 'device' && slice.devices.length)) {
      return []
    }
    const operator = op === 'eq' ? 'equals' : op === 'regex' ? 'includingRegex' : 'excludingRegex'
    return [{ dimension, operator, expression: value }]
  })
}

export async function readGoogleDashboardRows(read: GoogleRowsReader, slice: GoogleSearchSlice, options: RequestOptions) {
  const rows = await read(buildGoogleRowsRequest(slice, options))
  return rows.map((source) => {
    const row: Row = {}
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' || typeof value === 'number' || value === null)
        row[key] = value
    }
    if (typeof row.query === 'string') {
      row.queryCanonical = row.query
      row.keyword = row.query
    }
    return row
  })
}

/** Keep entity pins distinct from optional facets, which may be inapplicable. */
export function googleEntityFilter(slice: GoogleSearchSlice, column: string, value: string): NonNullable<RequestOptions['filters']>[number] {
  const dimension = googleDimension(column)
  if (dimension === 'query' && slice.googleBrand)
    throw new Error('Query details and trends are unavailable with Google classification. Clear Google classification to view them.')
  return { dimension, operator: 'equals', expression: value }
}

export function googleEntitySlice(slice: GoogleSearchSlice, column: string, value: string): GoogleSearchSlice | null {
  if (column === 'country') {
    if (slice.countries.length && !slice.countries.includes(value))
      return null
    return { ...slice, countries: [] }
  }
  if (column === 'device') {
    const devices: readonly string[] = slice.devices
    if (devices.length && !devices.includes(value))
      return null
    return { ...slice, devices: [] }
  }
  return slice
}

/** Exact entity reads avoid site-wide caps and never repeat unrelated rows. */
export async function readGoogleEntitySeries(
  read: GoogleRowsReader,
  slice: GoogleSearchSlice,
  options: { range: RequestOptions['range'], dimension: string, keys: readonly string[], filters: NonNullable<RequestOptions['filters']> },
) {
  const days = sparklineDateAxis(options.range.start, options.range.end).length
  const rows: Awaited<ReturnType<typeof readGoogleDashboardRows>> = []
  // A single entity has at most one row per day. The extra row detects a
  // truncated or unexpectedly expanded response instead of plotting zeros.
  const limit = days + 1
  if (limit > 25_000)
    throw new Error('Search trend could not load.')
  const pins = [...new Set(options.keys)].map(key => googleEntityFilter(slice, options.dimension, key))
  for (const pin of pins) {
    const selected = googleEntitySlice(slice, options.dimension, pin.expression)
    if (!selected)
      continue
    const series = await readGoogleDashboardRows(read, selected, {
      range: options.range,
      dimensions: ['date', googleDimension(options.dimension)],
      filters: [...options.filters, pin],
      limit,
    })
    if (series.length >= limit)
      throw new Error('Search trend could not load.')
    rows.push(...series)
  }
  return rows
}
