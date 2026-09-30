// Every browser read on the Search Console pages builds its v1 analytics
// request here. Pure module: no Vue, no fetch.
//
// Each builder takes the search type as a required input and parses its output
// against the `@gscdump/contracts` schema before it returns. Two failure modes
// motivated this:
//
// - The search-type picker never reached a report read, because each call site
//   built its own state and none of them set `searchType`. A required argument
//   makes that impossible to forget.
// - A read asked a list report for the `date` dimension, which the contract
//   rejects before the request leaves. The report state is also a loose object,
//   so a mistyped field passes the contract and the engine drops it silently.
//   Parsing here, against the stricter rows schema too, turns both into a
//   thrown error that a unit test sees.
import type { GscSearchType } from '@gscdump/contracts'
import type { GscdumpV1OperationInput } from '@gscdump/sdk/v1'
import type { Filter, Metric } from 'gscdump/query'
import type { GscComparisonFilter } from './gscdump-api'
import type { DateFilterRange } from './utils/filter-wire'
import type { GscFacet } from './utils/gsc-facets'
import { createGscdumpV1Protocol } from '@gscdump/contracts/v1/http'
import { contains, country, device, eq, inArray, page, query, queryCanonical } from 'gscdump/query'
import { andFilter, dateFilter } from './utils/filter-wire'
import { facetsToFilters } from './utils/gsc-facets'
import { sparklineDateAxis } from './utils/gsc-series'

type ListReportBody = GscdumpV1OperationInput<'analytics.reports.query'>['body']
type DetailReportBody = GscdumpV1OperationInput<'analytics.reports.detail.query'>['body']
type RowsBody = GscdumpV1OperationInput<'analytics.rows.query'>['body']

declare const contractParsed: unique symbol
/** A request body that passed the contract parse. Only this module makes one. */
type Parsed<T> = T & { readonly [contractParsed]: true }

export type ListReportRequest = Parsed<ListReportBody>
export type DetailReportRequest = Parsed<DetailReportBody>
export type RowsRequest = Parsed<RowsBody>

/** A dimension a list report can rank by. A list report rejects `date`. */
export type BreakdownDimension = 'page' | 'query' | 'queryCanonical' | 'country' | 'device'
/** A dimension a daily series can be keyed by. */
export type SeriesDimension = 'page' | 'query' | 'queryCanonical' | 'country'
/** The single value a daily report can be pinned to. */
export interface DailySeriesFilter { column: BreakdownDimension, value: string }

const COLUMNS = { country, device, page, query, queryCanonical } as const

/** The engine maximum for one read. */
const MAX_ROWS = 25_000
/** Counterparts one association key may carry before the read stops being worth widening. */
const COUNTERPARTS_PER_KEY = 50

let schemas: ReturnType<typeof createGscdumpV1Protocol>['schemas'] | undefined
function contract() {
  schemas ??= createGscdumpV1Protocol().schemas
  return schemas
}

type SafeParse<T>
  = | { success: true, data: T }
    | { success: false, error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>, message: string }> } }

function parsed<T>(operation: string, result: SafeParse<T>): T {
  if (result.success)
    return result.data
  const issues = result.error.issues
    .map(issue => `${issue.path.map(String).join('.') || 'body'}: ${issue.message}`)
    .join('; ')
  throw new Error(`The ${operation} request does not match the gscdump v1 contract. ${issues}`)
}

interface ReportState {
  dimensions: string[]
  filter: Filter<unknown>
  orderBy?: { column: Metric | 'date', dir: 'asc' | 'desc' }
  rowLimit?: number
  startRow?: number
}

/**
 * The report contract accepts any extra state field and the engine ignores it.
 * The rows request names every field a state may carry, so parse against it
 * strictly as well.
 */
function strictState(operation: string, state: ReportState, searchType: GscSearchType) {
  return parsed(operation, contract().analyticsRowsRequest.safeParse({ ...state, searchType }))
}

function listReport(input: { searchType: GscSearchType, state: ReportState, comparison?: ReportState, filter?: GscComparisonFilter }): ListReportRequest {
  const operation = 'analytics.reports.query'
  const body = {
    state: strictState(operation, input.state, input.searchType),
    ...(input.comparison ? { comparison: strictState(operation, input.comparison, input.searchType) } : {}),
    ...(input.filter ? { filter: input.filter } : {}),
  }
  return parsed(operation, contract().analyticsReportRequest.safeParse(body)) as ListReportRequest
}

function detailReport(input: { searchType: GscSearchType, state: ReportState, comparison?: ReportState }): DetailReportRequest {
  const operation = 'analytics.reports.detail.query'
  const body = {
    state: strictState(operation, input.state, input.searchType),
    ...(input.comparison ? { comparison: strictState(operation, input.comparison, input.searchType) } : {}),
  }
  return parsed(operation, contract().analyticsReportDetailRequest.safeParse(body)) as DetailReportRequest
}

function rows(input: Omit<RowsBody, 'filter' | 'searchType'> & { searchType: GscSearchType, filter: Filter<unknown> }): RowsRequest {
  return parsed('analytics.rows.query', contract().analyticsRowsRequest.safeParse(input)) as RowsRequest
}

export interface BreakdownInput {
  searchType: GscSearchType
  dimension: BreakdownDimension
  range: DateFilterRange
  /** The previous window for the deltas, or null when comparison is off. */
  comparisonRange: DateFilterRange | null
  /** Text the dimension value must contain, from a table search box. */
  search?: string
  facets?: readonly GscFacet[]
  extraFilters?: readonly Filter<object>[]
  orderBy: { column: Metric, dir: 'asc' | 'desc' }
  rowLimit: number
  startRow?: number
  /** Movers re-ranking. It needs deltas, so it is dropped without a comparison range. */
  moversFilter?: GscComparisonFilter
}

/** One ranked list over one dimension: every table, mover list and trend candidate read. */
export function breakdownRequest(input: BreakdownInput): ListReportRequest {
  const where = (range: DateFilterRange) => andFilter(
    dateFilter(range),
    input.search ? contains(COLUMNS[input.dimension], input.search) : null,
    ...facetsToFilters(input.facets),
    ...(input.extraFilters ?? []),
  )
  const comparisonRange = input.comparisonRange
  return listReport({
    searchType: input.searchType,
    state: {
      dimensions: [input.dimension],
      filter: where(input.range),
      orderBy: input.orderBy,
      rowLimit: input.rowLimit,
      ...(input.startRow !== undefined ? { startRow: input.startRow } : {}),
    },
    ...(comparisonRange
      ? {
          comparison: { dimensions: [input.dimension], filter: where(comparisonRange) },
          ...(input.moversFilter ? { filter: input.moversFilter } : {}),
        }
      : {}),
  })
}

export interface PeriodCountInput {
  searchType: GscSearchType
  dimension: BreakdownDimension
  range: DateFilterRange
  facets?: readonly GscFacet[]
}

/**
 * The breakdown behind a distinct count for one period, such as "Queries
 * ranked". The engine counts a comparison read over the full outer join of both
 * windows, so this read never carries one. It asks for one row, because only
 * the count is wanted.
 */
export function periodCountInput(input: PeriodCountInput): BreakdownInput {
  return {
    ...input,
    comparisonRange: null,
    orderBy: { column: 'clicks', dir: 'desc' },
    rowLimit: 1,
  }
}

export interface AssociationInput {
  searchType: GscSearchType
  /** Dimension the table rows are keyed by. The top of the other one is ranked. */
  group: 'query' | 'queryCanonical' | 'page'
  keys: readonly string[]
  range: DateFilterRange
}

/** Every key's counterparts in one read: the top page per query, or the top query per page. */
export function associationRequest(input: AssociationInput): ListReportRequest {
  const counterpart = input.group === 'page' ? 'query' : 'page'
  return listReport({
    searchType: input.searchType,
    state: {
      dimensions: [input.group, counterpart],
      filter: andFilter(dateFilter(input.range), inArray(COLUMNS[input.group], [...input.keys])),
      orderBy: { column: 'clicks', dir: 'desc' },
      rowLimit: Math.min(MAX_ROWS, input.keys.length * COUNTERPARTS_PER_KEY),
    },
  })
}

export interface DailyReportInput {
  searchType: GscSearchType
  range: DateFilterRange
  /** The previous window for the totals, or null when comparison is off. */
  comparisonRange: DateFilterRange | null
  /** Pin the series to one page, query or country. Absent for the whole Site. */
  pin?: DailySeriesFilter
}

/** The daily series and totals behind the hero chart and the entity detail charts. */
export function dailyReportRequest(input: DailyReportInput): DetailReportRequest {
  const where = (range: DateFilterRange) => input.pin
    ? andFilter(dateFilter(range), eq(COLUMNS[input.pin.column], input.pin.value))
    : dateFilter(range)
  return detailReport({
    searchType: input.searchType,
    state: { dimensions: ['date'], filter: where(input.range), orderBy: { column: 'date', dir: 'asc' } },
    ...(input.comparisonRange ? { comparison: { dimensions: ['date'], filter: where(input.comparisonRange) } } : {}),
  })
}

export interface EntityDailySeriesInput {
  searchType: GscSearchType
  dimension: SeriesDimension
  keys: readonly string[]
  range: DateFilterRange
  metric: Metric
  facets?: readonly GscFacet[]
}

/**
 * One `(dimension, date)` series per key, for the table sparklines and the
 * trend panel bands. A list report rejects `date`, so this is a rows read.
 */
export function entityDailySeriesRequest(input: EntityDailySeriesInput): RowsRequest {
  const days = sparklineDateAxis(input.range.start, input.range.end).length
  return rows({
    searchType: input.searchType,
    dimensions: [input.dimension, 'date'],
    metrics: [input.metric],
    filter: andFilter(dateFilter(input.range), inArray(COLUMNS[input.dimension], [...input.keys]), ...facetsToFilters(input.facets)),
    // One row per key per day, plus headroom for a partial day bucket.
    rowLimit: Math.min(MAX_ROWS, input.keys.length * (days + 1)),
  })
}

export interface SiteDailySeriesInput {
  searchType: GscSearchType
  range: DateFilterRange
  metric: Metric
  facets?: readonly GscFacet[]
}

/** The Site's own daily total, which the trend panel's "All Others" band is measured against. */
export function siteDailySeriesRequest(input: SiteDailySeriesInput): RowsRequest {
  const days = sparklineDateAxis(input.range.start, input.range.end).length
  return rows({
    searchType: input.searchType,
    dimensions: ['date'],
    metrics: [input.metric],
    filter: andFilter(dateFilter(input.range), ...facetsToFilters(input.facets)),
    rowLimit: Math.min(MAX_ROWS, days + 1),
  })
}
