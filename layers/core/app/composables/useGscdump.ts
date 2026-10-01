import type {
  GscComparisonFilter,
  GscdumpAnalysisParams,
  GscdumpDataDetailResponse,
  GscdumpDataResponse,
  GscdumpDataRow,
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingUrlsResponse,
  GscdumpMeta,
  GscdumpPageTrendResponse,
  GscdumpQueryTrendResponse,
  GscdumpSitemapsResponse,
} from '@gscdump/contracts'
import type { RollingPeriod } from '@gscdump/sdk/period'
import type { GscdumpV1Client, GscdumpV1OperationInput } from '@gscdump/sdk/v1'
import type { BuilderState, Column, Filter, Metric } from 'gscdump/query'
import { toPartnerError } from '@gscdump/sdk/partner-errors'
import { periodToDays as gscPeriodToDays } from '@gscdump/sdk/period'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import { and, between, contains, country, date, device, daysAgo as gscDaysAgo, page as pageColumn, queryCanonical, query as queryColumn } from 'gscdump/query'

export type {
  GscdumpAnalysisPreset as AnalysisPreset,
  GscComparisonFilter,
  GscdumpAnalysisParams,
  GscdumpDataDetailResponse,
  GscdumpDataResponse,
  GscdumpDataRow,
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingResponse,
  GscdumpIndexingUrlsResponse,
  GscdumpMeta,
  GscdumpSitemap,
  GscdumpSitemapsResponse,
} from '@gscdump/contracts'

export interface GscdumpAnalysisResult {
  keyword: string
  queryCanonical?: string
  variantCount?: number
  variants?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
  page?: string
  topPage?: string
  prevClicks?: number
  prevImpressions?: number
  prevCtr?: number
  prevPosition?: number
  potentialClicks?: number
  opportunityScore?: number
  clicksChange?: number
  clicksChangePercent?: number
  positionChange?: number
  decayPercent?: number
  missedClicks?: number
}

export interface GscdumpAnalysisResponse {
  preset: string
  keywords: GscdumpAnalysisResult[]
  totalCount: number
  summary?: {
    brandClicks: number
    nonBrandClicks: number
    brandShare: number
    brandImpressions: number
    nonBrandImpressions: number
  }
  meta: {
    siteUrl: string
    presetDescription: string
    params: Record<string, unknown>
  }
}

// ===== Session-proxied v1 client =====
//
// The browser never holds a gscdump API key. Requests go same-origin to the
// Nitro proxy (`server/api/_gscdump/[surface]/v1/[...path].ts`), which
// authenticates the session, resolves the caller's own stored gscdump
// credential server-side, and forwards upstream: the key never reaches
// browser memory. `'session-proxy'` is an opaque literal that only satisfies
// the SDK's transport shape; the proxy discards it entirely.

function createV1Client(): GscdumpV1Client {
  return createGscdumpV1Client({
    apiRoot: '/api/_gscdump',
    credential: 'session-proxy',
    fetch: (request, init) => {
      const headers = new Headers(init?.headers)
      headers.delete('authorization')
      return fetch(request, { ...init, headers })
    },
  })
}

// ===== Error Handling =====

export interface GscdumpError {
  message: string
  code: 'AUTH' | 'NOT_FOUND' | 'RATE_LIMIT' | 'SERVER' | 'NETWORK' | 'UNKNOWN'
  status?: number
  retry?: boolean
}

function parseGscdumpError(e: unknown): GscdumpError {
  const error = toPartnerError(e)
  const status = error.statusCode
  switch (error.kind) {
    case 'auth':
    case 'permission':
      return { message: 'Authentication failed. Please reconnect your account.', code: 'AUTH', status, retry: false }
    case 'not-found':
      return { message: 'Data not found. The Site may not be synced yet.', code: 'NOT_FOUND', status, retry: false }
    case 'rate-limit':
      return { message: 'Rate limited. Please wait a moment and try again.', code: 'RATE_LIMIT', status, retry: true }
    case 'server':
      return { message: 'Server error. Please try again later.', code: 'SERVER', status, retry: true }
    case 'network':
      return { message: 'Network error. Check your connection.', code: 'NETWORK', status, retry: true }
    default:
      return { message: error.message || 'An error occurred', code: 'UNKNOWN', status, retry: true }
  }
}

const recentToasts = new Map<string, number>()
const TOAST_DEDUPE_MS = 5000

// ===== Core Composable =====

export function useGscdump() {
  const toast = useToast()
  const error = ref<GscdumpError | null>(null)

  function _showErrorToast(gscdumpError: GscdumpError) {
    const key = `${gscdumpError.code}:${gscdumpError.message}`
    const now = Date.now()

    if (recentToasts.has(key) && now - recentToasts.get(key)! < TOAST_DEDUPE_MS)
      return
    recentToasts.set(key, now)

    for (const [k, v] of recentToasts) {
      if (now - v > TOAST_DEDUPE_MS)
        recentToasts.delete(k)
    }

    toast.add({
      title: 'Data Loading Error',
      description: gscdumpError.message,
      color: gscdumpError.code === 'AUTH' ? 'warning' : 'error',
      icon: gscdumpError.code === 'NETWORK' ? 'i-lucide-wifi-off' : 'i-lucide-alert-circle',
    })
  }

  async function runV1<T>(
    request: (client: GscdumpV1Client) => Promise<{ data: unknown }>,
    silent = false,
  ): Promise<T> {
    try {
      const client = createV1Client()
      const response = await request(client)
      return response.data as T
    }
    catch (e) {
      const parsed = parseGscdumpError(e)
      error.value = parsed
      if (!silent)
        _showErrorToast(parsed)
      throw e
    }
  }

  function queryAnalyticsReport(input: GscdumpV1OperationInput<'analytics.reports.query'>, silent = false) {
    return runV1<GscdumpDataResponse>(client => client.queryAnalyticsReport(input), silent)
  }

  function queryAnalyticsReportDetail(input: GscdumpV1OperationInput<'analytics.reports.detail.query'>, silent = false) {
    return runV1<GscdumpDataDetailResponse>(client => client.queryAnalyticsReportDetail(input), silent)
  }

  function getQueryTrend(input: GscdumpV1OperationInput<'partner.sites.query.trend.get'>, silent = false) {
    return runV1<GscdumpQueryTrendResponse>(client => client.getQueryTrend(input), silent)
  }

  function getPageTrend(input: GscdumpV1OperationInput<'partner.sites.page.trend.get'>, silent = false) {
    return runV1<GscdumpPageTrendResponse>(client => client.getPageTrend(input), silent)
  }

  function getSiteAnalysis(input: GscdumpV1OperationInput<'partner.sites.analysis.get'>, silent = false) {
    return runV1<GscdumpAnalysisResponse>(client => client.getSiteAnalysis(input), silent)
  }

  function listSiteIndexingUrls(input: GscdumpV1OperationInput<'partner.sites.indexing.urls.list'>, silent = false) {
    return runV1<GscdumpIndexingUrlsResponse>(client => client.listSiteIndexingUrls(input), silent)
  }

  function getSiteIndexingDiagnostics(input: GscdumpV1OperationInput<'partner.sites.indexing.diagnostics.get'>, silent = false) {
    return runV1<GscdumpIndexingDiagnosticsResponse>(client => client.getSiteIndexingDiagnostics(input), silent)
  }

  function getSiteSitemaps(input: GscdumpV1OperationInput<'partner.sites.sitemaps.get'>, silent = false) {
    return runV1<GscdumpSitemapsResponse>(client => client.getSiteSitemaps(input), silent)
  }

  return {
    error,
    getSiteAnalysis,
    getSiteIndexingDiagnostics,
    getSiteSitemaps,
    getPageTrend,
    getQueryTrend,
    listSiteIndexingUrls,
    queryAnalyticsReport,
    queryAnalyticsReportDetail,
  }
}

// ===== Data Composables =====

export function useGscdumpData(
  siteId: MaybeRefOrGetter<string>,
  state: MaybeRefOrGetter<BuilderState>,
  options?: {
    comparison?: MaybeRefOrGetter<BuilderState | undefined>
    filter?: MaybeRefOrGetter<GscComparisonFilter | undefined>
    immediate?: boolean
    watch?: boolean
  },
) {
  const _siteId = computed(() => toValue(siteId))
  const _state = computed(() => toValue(state))
  const _comparison = computed(() => toValue(options?.comparison))
  const _filter = computed(() => toValue(options?.filter))

  const key = computed(() => {
    const parts = ['gscdump', 'data', _siteId.value, JSON.stringify(_state.value)]
    if (_comparison.value)
      parts.push(JSON.stringify(_comparison.value))
    if (_filter.value)
      parts.push(_filter.value)
    return parts.join(':')
  })

  return useAsyncData<GscdumpDataResponse>(
    key,
    async () => {
      if (!_siteId.value)
        return null as unknown as GscdumpDataResponse
      const { queryAnalyticsReport } = useGscdump()
      return queryAnalyticsReport({
        params: { siteId: _siteId.value },
        body: {
          state: _state.value,
          comparison: _comparison.value,
          filter: _filter.value,
        },
      })
    },
    {
      server: false,
      immediate: options?.immediate ?? true,
      watch: (options?.watch ?? true) ? [_siteId, _state, _comparison, _filter] : undefined,
    },
  )
}

export function useGscdumpDataDetail(
  siteId: MaybeRefOrGetter<string>,
  state: MaybeRefOrGetter<BuilderState>,
  options?: {
    comparison?: MaybeRefOrGetter<BuilderState | undefined>
    immediate?: boolean
    watch?: boolean
  },
) {
  const _siteId = computed(() => toValue(siteId))
  const _state = computed(() => toValue(state))
  const _comparison = computed(() => toValue(options?.comparison))

  const key = computed(() => {
    const parts = ['gscdump', 'detail', _siteId.value, JSON.stringify(_state.value)]
    if (_comparison.value)
      parts.push(JSON.stringify(_comparison.value))
    return parts.join(':')
  })

  return useAsyncData<GscdumpDataDetailResponse>(
    key,
    async () => {
      if (!_siteId.value)
        return null as unknown as GscdumpDataDetailResponse
      const { queryAnalyticsReportDetail } = useGscdump()
      return queryAnalyticsReportDetail({
        params: { siteId: _siteId.value },
        body: {
          state: _state.value,
          comparison: _comparison.value,
        },
      })
    },
    {
      server: false,
      immediate: options?.immediate ?? true,
      watch: (options?.watch ?? true) ? [_siteId, _state, _comparison] : undefined,
    },
  )
}

export function useGscdumpAnalysis(
  siteId: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscdumpAnalysisParams>,
  options?: { immediate?: boolean, watch?: boolean },
) {
  const _siteId = computed(() => toValue(siteId))
  const _params = computed(() => toValue(params))
  const key = computed(() => ['gscdump', 'analysis', _siteId.value, JSON.stringify(_params.value)].join(':'))

  return useAsyncData<GscdumpAnalysisResponse>(
    key,
    async () => {
      if (!_siteId.value)
        return null as unknown as GscdumpAnalysisResponse
      const { getSiteAnalysis } = useGscdump()
      return getSiteAnalysis({ params: { siteId: _siteId.value }, query: _params.value })
    },
    {
      server: false,
      immediate: options?.immediate ?? true,
      watch: (options?.watch ?? true) ? [_siteId, _params] : undefined,
    },
  )
}

export function useGscdumpSitemaps(
  siteId: MaybeRefOrGetter<string | undefined>,
  options?: { immediate?: boolean, watch?: boolean },
) {
  const _siteId = computed(() => toValue(siteId))
  const key = computed(() => `gscdump:sitemaps:${_siteId.value}`)

  return useAsyncData<GscdumpSitemapsResponse>(
    key,
    async () => {
      if (!_siteId.value)
        return null as unknown as GscdumpSitemapsResponse
      const { getSiteSitemaps } = useGscdump()
      return getSiteSitemaps({ params: { siteId: _siteId.value } })
    },
    {
      server: false,
      immediate: options?.immediate ?? true,
      watch: (options?.watch ?? true) ? [_siteId] : undefined,
    },
  )
}

// ===== Table Data Helper =====

export type Period = RollingPeriod

export function periodToDays(period: Period | string): number {
  return gscPeriodToDays(period)
}

export function daysAgo(days: number): string {
  return gscDaysAgo(days)
}

type GscdumpTableDimension = 'page' | 'query' | 'queryCanonical' | 'country' | 'device' | 'date'

const GSCDUMP_DIMENSION_COLUMNS = {
  country,
  date,
  device,
  page: pageColumn,
  query: queryColumn,
  queryCanonical,
} satisfies Record<GscdumpTableDimension, Column<GscdumpTableDimension>>

export interface GscdumpTableOptions {
  siteId: MaybeRefOrGetter<string | undefined>
  dimension: GscdumpTableDimension
  period?: MaybeRefOrGetter<Period>
  pageSize?: number
  defaultSort?: { column: Metric | 'date', direction: 'asc' | 'desc' }
  extraFilters?: MaybeRefOrGetter<Array<Filter<object>> | undefined>
}

export interface GscdumpTableResponse<T = GscdumpDataRow> {
  rows: T[]
  total: number
  totalClicks: number
  totalImpressions: number
  hasPrevData: boolean
  meta: GscdumpMeta | null
}

export function useGscdumpTableData<T = GscdumpDataRow>(options: GscdumpTableOptions) {
  const { siteId, dimension, pageSize = 50, defaultSort } = options

  const _siteId = computed(() => toValue(siteId))
  const _period = computed(() => toValue(options.period) ?? '28d')
  const _extraFilters = computed(() => toValue(options.extraFilters) ?? [])

  const q = ref('')
  const page = ref(1)
  const filter = ref<GscComparisonFilter | 'default'>('default')
  const sort = ref<{ column: Metric | 'date', direction: 'asc' | 'desc' }>(defaultSort ?? { column: 'clicks', direction: 'desc' })
  const _isLoading = ref(false)
  const isLoading = computed(() => _isLoading.value)
  const error = ref<GscdumpError | null>(null)
  const data = ref<GscdumpTableResponse<T>>({
    rows: [],
    total: 0,
    totalClicks: 0,
    totalImpressions: 0,
    hasPrevData: false,
    meta: null,
  })

  const rows = computed(() => data.value.rows)
  const total = computed(() => data.value.total)

  async function refresh() {
    const siteIdVal = _siteId.value
    if (!siteIdVal)
      return

    _isLoading.value = true
    error.value = null

    const days = periodToDays(_period.value)
    const offset = (page.value - 1) * pageSize

    const filters = [
      between(date, daysAgo(days), daysAgo(1)),
      q.value ? contains(GSCDUMP_DIMENSION_COLUMNS[dimension], q.value) : null,
      ..._extraFilters.value,
    ].filter((value): value is Filter<object> => value != null)

    const state: BuilderState = {
      dimensions: [dimension],
      filter: and(...filters),
      orderBy: { column: sort.value.column, dir: sort.value.direction },
      rowLimit: pageSize,
      startRow: offset,
    }

    const comparison: BuilderState = {
      dimensions: [dimension],
      filter: between(date, daysAgo(days * 2), daysAgo(days + 1)),
    }

    const gscdump = useGscdump()
    const result = await gscdump.queryAnalyticsReport({
      params: { siteId: siteIdVal },
      body: {
        state,
        comparison,
        filter: filter.value === 'default' ? undefined : filter.value,
      },
    }, true)
      .catch(() => {
        error.value = gscdump.error.value
        return null
      })
      .finally(() => { _isLoading.value = false })

    if (!result)
      return

    const oldestSynced = result.meta?.oldestDateSynced
    const prevStartDate = daysAgo(days * 2 + 2)
    const hasPrevData = !!(oldestSynced && prevStartDate >= oldestSynced)

    data.value = {
      rows: result.rows as T[],
      total: result.totalCount,
      totalClicks: result.totals?.clicks ?? 0,
      totalImpressions: result.totals?.impressions ?? 0,
      hasPrevData,
      meta: result.meta ?? null,
    }
  }

  function toggleFilter(newFilter: GscComparisonFilter | 'default') {
    filter.value = filter.value === newFilter ? 'default' : newFilter
    page.value = 1
  }

  function setPage(newPage: number) {
    page.value = newPage
  }

  function setSort(column: Metric | 'date', direction: 'asc' | 'desc' = 'desc') {
    sort.value = { column, direction }
    page.value = 1
  }

  function toggleSort(column: Metric | 'date') {
    if (sort.value.column === column)
      sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
    else
      sort.value = { column, direction: 'desc' }
    page.value = 1
  }

  watch([q, filter, page, sort, _siteId, _period, _extraFilters], () => {
    if (_siteId.value)
      refresh()
  }, { deep: true })

  // Client-only, like every other composable in this file (they all pass
  // `server: false` to `useAsyncData`). This one instead fired an async
  // `refresh()` straight out of an immediate watcher, so it ran during the
  // server render and 500'd every route that mounts a table — overview, pages,
  // keywords, keyword-insights — while client-side navigation to the same
  // routes worked. The response is caller-scoped and never part of the
  // server-rendered HTML, so there is nothing to gain by fetching it here.
  watch(_siteId, (id) => {
    if (id && import.meta.client)
      refresh()
  }, { immediate: true })

  return {
    q,
    page,
    filter,
    sort,
    isLoading,
    error,
    data,
    rows,
    total,
    pageSize,
    refresh,
    toggleFilter,
    setPage,
    setSort,
    toggleSort,
  }
}
