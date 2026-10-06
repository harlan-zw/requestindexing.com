// Typed v1 client, session-proxied. The browser never holds a gscdump API
// key: requests go same-origin to the v1 proxy
// (`server/api/_gscdump/[surface]/v1/[...path].ts`), which authenticates the
// session, resolves the caller's stored gscdump credential server-side, and
// forwards upstream. `'session-proxy'` only satisfies the SDK's transport
// shape; the proxy discards it and never echoes the real credential back.
//
// Every operation this consumer needs is a typed method below, routed
// through the proxy's closed allowlist. There is no generic path escape
// hatch: one was removed with the credential (see `gscdump-v1-browser-proxy.ts`).
import type { GscdumpV1OperationInput, GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { DetailReportRequest, ListReportRequest, RowsRequest } from '../../../shared/analytics-requests'
import type {
  GscdumpAnalysisResponse,
  GscdumpDataDetailResponse,
  GscdumpDataResponse,
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingResponse,
  GscdumpIndexingUrlsResponse,
  GscdumpInspectResponse,
  GscdumpSitemapChangesResponse,
  GscdumpSitemapsResponse,
} from '../../../shared/gscdump-api'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import { showGscdumpErrorToast } from '../../utils/gscdump-toast'
import { parseGscdumpError } from '../_gscdump-error'

function createV1Client() {
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

export function useProGscdump() {
  // The v1 schemas are deliberately wider than this consumer's established
  // read models (for example nullable inspection fields). Keep the cast at one
  // compatibility boundary while every request remains operation-typed.
  async function runV1<T>(request: () => Promise<{ data: unknown }>, silent = false): Promise<T> {
    return request()
      .then(response => response.data as T)
      .catch((error) => {
        if (!silent)
          showGscdumpErrorToast(parseGscdumpError(error))
        throw error
      })
  }

  // The analytics reads take only a body from `shared/analytics-requests`, so
  // every one carries the search type and has passed the contract parse.
  function queryAnalyticsReport(input: { params: { siteId: string }, body: ListReportRequest }, silent = false) {
    return runV1<GscdumpDataResponse>(() => createV1Client().queryAnalyticsReport(input), silent)
  }

  /** Raw grouped rows. Unlike a list report, it accepts `date` as a dimension. */
  function queryAnalyticsRows(input: { params: { siteId: string }, body: RowsRequest }, silent = false) {
    return runV1<GscdumpV1OperationResponse<'analytics.rows.query'>['data']>(() => createV1Client().queryAnalyticsRows(input), silent)
  }

  function queryAnalyticsReportDetail(input: { params: { siteId: string }, body: DetailReportRequest }, silent = false) {
    return runV1<GscdumpDataDetailResponse>(() => createV1Client().queryAnalyticsReportDetail(input), silent)
  }

  function getSiteAnalysis(input: GscdumpV1OperationInput<'partner.sites.analysis.get'>, silent = false) {
    return runV1<GscdumpAnalysisResponse>(() => createV1Client().getSiteAnalysis(input), silent)
  }

  function getSiteAnalyticsCoverage(input: GscdumpV1OperationInput<'partner.sites.analytics.coverage.get'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.analytics.coverage.get'>['data']>(() => createV1Client().getSiteAnalyticsCoverage(input), silent)
  }

  function getSiteIndexing(input: GscdumpV1OperationInput<'partner.sites.indexing.get'>, silent = false) {
    return runV1<GscdumpIndexingResponse>(() => createV1Client().getSiteIndexing(input), silent)
  }

  function listSiteIndexingUrls(input: GscdumpV1OperationInput<'partner.sites.indexing.urls.list'>, silent = false) {
    return runV1<GscdumpIndexingUrlsResponse>(() => createV1Client().listSiteIndexingUrls(input), silent)
  }

  function getSiteIndexingDiagnostics(input: GscdumpV1OperationInput<'partner.sites.indexing.diagnostics.get'>, silent = false) {
    return runV1<GscdumpIndexingDiagnosticsResponse>(() => createV1Client().getSiteIndexingDiagnostics(input), silent)
  }

  function inspectSiteUrls(input: GscdumpV1OperationInput<'partner.sites.indexing.inspect.create'>, silent = false) {
    return runV1<GscdumpInspectResponse>(() => createV1Client().inspectSiteUrls(input), silent)
  }

  function getSiteSitemaps(input: GscdumpV1OperationInput<'partner.sites.sitemaps.get'>, silent = false) {
    return runV1<GscdumpSitemapsResponse>(() => createV1Client().getSiteSitemaps(input), silent)
  }

  function getSiteSitemapChanges(input: GscdumpV1OperationInput<'partner.sites.sitemaps.changes.get'>, silent = false) {
    return runV1<GscdumpSitemapChangesResponse>(() => createV1Client().getSiteSitemapChanges(input), silent)
  }

  function getSiteSitemapSubmission(input: GscdumpV1OperationInput<'partner.sites.sitemaps.submission.get'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.get'>['data']>(() => createV1Client().getSiteSitemapSubmission(input), silent)
  }

  function submitSiteSitemap(input: GscdumpV1OperationInput<'partner.sites.sitemaps.submission.create'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.create'>['data']>(() => createV1Client().submitSiteSitemap(input), silent)
  }

  function recoverSitePermission(input: GscdumpV1OperationInput<'partner.sites.permission.recover'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.permission.recover'>['data']>(
      () => createV1Client().recoverSitePermission(input),
      silent,
    )
  }

  function listSiteIndexingTransitions<T = GscdumpV1OperationResponse<'partner.sites.indexing.transitions.list'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.transitions.list'>, silent = false) {
    return runV1<T>(() => createV1Client().listSiteIndexingTransitions(input), silent)
  }

  function getCanonicalMismatches<T = GscdumpV1OperationResponse<'partner.sites.canonical.mismatches.get'>['data']>(input: GscdumpV1OperationInput<'partner.sites.canonical.mismatches.get'>, silent = false) {
    return runV1<T>(() => createV1Client().getCanonicalMismatches(input), silent)
  }

  function createSitemapAction<T = GscdumpV1OperationResponse<'partner.sites.sitemaps.action.create'>['data']>(input: GscdumpV1OperationInput<'partner.sites.sitemaps.action.create'>, silent = false) {
    return runV1<T>(() => createV1Client().createSitemapAction(input), silent)
  }

  function getSiteBingData<T = GscdumpV1OperationResponse<'partner.sites.bing.data.get'>['data']>(input: GscdumpV1OperationInput<'partner.sites.bing.data.get'>, silent = false) {
    return runV1<T>(() => createV1Client().getSiteBingData(input), silent)
  }

  function getSiteBingConnection<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.connection.get'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.connection.get'>, silent = false) {
    return runV1<T>(() => createV1Client().getSiteBingConnection(input), silent)
  }

  function verifySiteBingConnection<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.connection.verify'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.connection.verify'>, silent = false) {
    return runV1<T>(() => createV1Client().verifySiteBingConnection(input), silent)
  }

  function listSiteBingIndexingEvidence<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.evidence.list'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.evidence.list'>, silent = false) {
    return runV1<T>(() => createV1Client().listSiteBingIndexingEvidence(input), silent)
  }

  // The fleet read names a gscdump user. The browser sends a placeholder id,
  // and the proxy always substitutes the caller's own.
  function listUserBingSites<T = GscdumpV1OperationResponse<'partner.users.indexing.bing.sites.list'>['data']>(input: GscdumpV1OperationInput<'partner.users.indexing.bing.sites.list'>, silent = false) {
    return runV1<T>(() => createV1Client().listUserBingSites(input), silent)
  }

  function linkSiteBing<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.link.create'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.link.create'>, silent = false) {
    return runV1<T>(() => createV1Client().linkSiteBing(input), silent)
  }

  // The proxy sets `returnUrl`. The browser sends an empty body.
  function createSiteBingAuthorization<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.authorization.create'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.authorization.create'>, silent = false) {
    return runV1<T>(() => createV1Client().createSiteBingAuthorization(input), silent)
  }

  function submitSiteBingSitemap<T = GscdumpV1OperationResponse<'partner.sites.indexing.bing.sitemaps.submit'>['data']>(input: GscdumpV1OperationInput<'partner.sites.indexing.bing.sitemaps.submit'>, silent = false) {
    return runV1<T>(() => createV1Client().submitSiteBingSitemap(input), silent)
  }

  function getSiteIndexNowConnection(input: GscdumpV1OperationInput<'partner.sites.indexing.indexnow.connection.get'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.get'>['data']>(
      () => createV1Client().getSiteIndexNowConnection(input),
      silent,
    )
  }

  function configureSiteIndexNowConnection(input: GscdumpV1OperationInput<'partner.sites.indexing.indexnow.connection.configure'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.configure'>['data']>(
      () => createV1Client().configureSiteIndexNowConnection(input),
      silent,
    )
  }

  function verifySiteIndexNowConnection(input: GscdumpV1OperationInput<'partner.sites.indexing.indexnow.connection.verify'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.verify'>['data']>(
      () => createV1Client().verifySiteIndexNowConnection(input),
      silent,
    )
  }

  function submitSiteIndexNow(input: GscdumpV1OperationInput<'partner.sites.indexing.indexnow.submissions.create'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.submissions.create'>['data']>(
      () => createV1Client().submitSiteIndexNow(input),
      silent,
    )
  }

  function listSiteIndexNowSubmissionReceipts(input: GscdumpV1OperationInput<'partner.sites.indexing.indexnow.submissions.list'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.submissions.list'>['data']>(
      () => createV1Client().listSiteIndexNowSubmissionReceipts(input),
      silent,
    )
  }

  // Google Submissions are created server side with the partner key. The
  // browser only reads their receipts.
  function listSiteGoogleSubmissionReceipts(input: GscdumpV1OperationInput<'partner.sites.indexing.google.submissions.list'>, silent = false) {
    return runV1<GscdumpV1OperationResponse<'partner.sites.indexing.google.submissions.list'>['data']>(
      () => createV1Client().listSiteGoogleSubmissionReceipts(input),
      silent,
    )
  }

  return {
    getSiteSitemapSubmission,
    submitSiteSitemap,
    getSiteIndexNowConnection,
    configureSiteIndexNowConnection,
    verifySiteIndexNowConnection,
    submitSiteIndexNow,
    listSiteIndexNowSubmissionReceipts,
    listSiteGoogleSubmissionReceipts,
    createSitemapAction,
    getCanonicalMismatches,
    getSiteAnalysis,
    createSiteBingAuthorization,
    getSiteBingConnection,
    getSiteBingData,
    linkSiteBing,
    listSiteBingIndexingEvidence,
    listUserBingSites,
    submitSiteBingSitemap,
    getSiteAnalyticsCoverage,
    getSiteIndexing,
    getSiteIndexingDiagnostics,
    getSiteSitemapChanges,
    getSiteSitemaps,
    listSiteIndexingTransitions,
    inspectSiteUrls,
    listSiteIndexingUrls,
    queryAnalyticsReport,
    queryAnalyticsReportDetail,
    queryAnalyticsRows,
    recoverSitePermission,
    verifySiteBingConnection,
  }
}
