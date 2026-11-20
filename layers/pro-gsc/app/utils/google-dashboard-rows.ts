import type { AnalyticsRowsV1Request } from '@gscdump/contracts/v1/http'
import type { GoogleSearchSlice } from './google-search-slice'
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
    // Google refuses a query-text filter with Google classification.
    // Country and device are already applied as lists in this request.
    if ((slice.googleBrand && dimension === 'query')
      || (dimension === 'country' && slice.countries.length)
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
