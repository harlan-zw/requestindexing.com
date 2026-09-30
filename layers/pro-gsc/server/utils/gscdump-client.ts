// gscdump.com Partner API client (Nuxt server adapter).
//
// Frozen public-v1 operations use the registry-driven SDK. The legacy client
// is kept only as a source of parameter types for the handful of user-management
// operations below; every request now goes through the v1 client.

import type {
  BuilderStateWire,
  CanonicalWebhookEventType,
  DataDetailOptions,
  DataQueryOptions,
  EntitlementRefusal,
  GscdumpAnalysisParams,
  GscdumpAvailableSite,
  GscdumpUserSite,
  IndexingDiagnosticsParams,
  IndexingUrlsParams,
  RegisterPartnerUserParams,
  UpdatePartnerUserTokensParams,
} from '@gscdump/contracts'
import type { PartnerSiteRegistrationV1Response, PartnerUserEntitlementsV1 } from '@gscdump/contracts/v1'
import type {
  GscdumpAnalysisResponse,
  GscdumpDataDetailResponse,
  GscdumpDataResponse,
  GscdumpSyncStatusResponse,
  PartnerLifecycleResponse,
  PartnerLifecycleSite,
} from '../../shared/gscdump-api'
import { GSCDUMP_ONBOARDING_CONTRACT_VERSION, parseEntitlementRefusal } from '@gscdump/contracts'
import { withDefaultSearchType } from '@gscdump/sdk/hosted-query'
import {
  analyticsStatusToSyncStatus,
  findLifecycleSite as findSdkLifecycleSite,
  lifecycleSiteToSyncStatus as lifecycleSdkSiteToSyncStatus,
} from '@gscdump/sdk/lifecycle'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { refusalMessage } from '../../shared/entitlement-copy'
import { createGscdumpPublicV1Client } from './gscdump-origin'

export { analyticsStatusToSyncStatus }
export type { GscdumpAvailableSite }

// gscdump rejects an event its deployed contracts do not know, so a newer SDK pin must not widen this list.
// A Billing-owner notice such as `user.allowance.notice` is not a Site event.
const SITE_WEBHOOK_EVENTS = [
  'user.lifecycle.changed',
  'site.lifecycle.changed',
  'site.analytics.ready',
  'site.indexing.ready',
  'site.auth.failed',
  'job.failed',
] as const satisfies readonly CanonicalWebhookEventType[]

/**
 * The outcome of `partner.users.sites.create`. An entitlement refusal is an
 * expected answer once the partner is metered, so it is a value, not a throw.
 */
export type SiteRegistrationResult
  = | { _tag: 'Registered', registration: PartnerSiteRegistrationV1Response['data'] }
    | { _tag: 'Refused', refusal: EntitlementRefusal }

/**
 * Whether this app's partner key can read a gscdump Site. gscdump answers
 * `site_not_found` for a Site that another partner or gscdump.com registered,
 * and for a deleted Site.
 */
export type GscdumpSiteAccess
  = | { _tag: 'Readable' }
    | { _tag: 'NotFound' }

export function findLifecycleSite(lifecycle: PartnerLifecycleResponse, siteIdOrPropertyUrl: string): PartnerLifecycleSite | null {
  return findSdkLifecycleSite(lifecycle as never, siteIdOrPropertyUrl) as PartnerLifecycleSite | null
}

export function lifecycleSiteToSyncStatus(site: PartnerLifecycleSite): ReturnType<typeof lifecycleSdkSiteToSyncStatus> {
  return lifecycleSdkSiteToSyncStatus(site as never)
}

// `PartnerLifecycleSite.indexing.reason` is an open `string | null` on the wire,
// while `GscdumpUserSite.indexingIneligibleReason` is a closed union. Narrow it
// once here; an unrecognised reason means "no known reason", not a crash.
const INDEXING_INELIGIBLE_REASONS = ['free_plan', 'missing_gsc_read_scope', 'insufficient_gsc_permission'] as const

function narrowIndexingIneligibleReason(reason: string | null): GscdumpUserSite['indexingIneligibleReason'] {
  return INDEXING_INELIGIBLE_REASONS.find(known => known === reason)
}

// SDK 3.x dropped `lifecycleSiteToUserSite`, so the projection lives here now.
// `GscdumpUserSite` is still a contracts type, so this is a pure re-shape of the
// lifecycle row, not a new local model.
export function lifecycleSiteToUserSite(site: PartnerLifecycleSite): GscdumpUserSite {
  const syncStatus = analyticsStatusToSyncStatus(site.analytics.status)
  return {
    siteId: site.siteId,
    siteUrl: site.gscPropertyUrl || site.requestedUrl,
    analyticsSyncStatus: syncStatus,
    analyticsSyncProgress: site.analytics.progress,
    syncStatus,
    syncProgress: site.analytics.progress,
    indexingEligible: site.indexing.eligible,
    indexingIneligibleReason: narrowIndexingIneligibleReason(site.indexing.reason),
    indexingPermissionLevel: site.permissionLevel,
    indexingStatus: site.indexing.status === 'ready'
      ? 'complete'
      : site.indexing.status === 'not_requested' ? 'not_started' : 'indexing',
    indexingProgress: site.indexing.progress,
    lastSyncAt: site.updatedAt ? Date.parse(site.updatedAt) : null,
    newestDateSynced: site.analytics.syncedRange.newest,
    oldestDateSynced: site.analytics.syncedRange.oldest,
  }
}

export function useGscdumpClient() {
  const client = createGscdumpPublicV1Client()

  function rethrowV1AsH3(err: unknown): never {
    if (isGscdumpV1Error(err)) {
      // gscdump's own message for an entitlement refusal points the reader to
      // Local mode. Render the refusal in this app's copy; the tag stays in
      // `details` for any caller that branches on it.
      const refusal = parseEntitlementRefusal(err.details)
      throw createError({
        statusCode: err.status ?? 500,
        message: refusal ? refusalMessage(refusal) : err.message,
        data: {
          code: err.code,
          details: err.details,
          requestId: err.requestId,
          retryable: err.retryable,
        },
      })
    }
    throw err
  }

  function toV1ReportState(state: BuilderStateWire, searchType?: DataQueryOptions['searchType']): BuilderStateWire & Record<string, unknown> {
    return withDefaultSearchType(state, searchType)
  }

  async function getUserLifecycle(userId: string): Promise<PartnerLifecycleResponse> {
    return client.getUserLifecycle({ params: { userId } })
      .then(response => ({
        contractVersion: GSCDUMP_ONBOARDING_CONTRACT_VERSION,
        ...response.data,
        sites: response.data.sites.map(site => ({
          intId: null,
          catalogSiteId: null,
          lifecycleRevision: 0,
          ...site,
        })),
      }))
      .catch(rethrowV1AsH3)
  }

  async function getSiteSyncStatus(siteId: string, userId: string): Promise<GscdumpSyncStatusResponse> {
    const lifecycle = await getUserLifecycle(userId)
    const site = findLifecycleSite(lifecycle, siteId)
    if (!site)
      throw createError({ statusCode: 404, message: 'Site not found in gscdump lifecycle' })
    return lifecycleSiteToSyncStatus(site) as GscdumpSyncStatusResponse
  }

  async function waitForUserReady(userId: string, options: {
    attempts?: number
    intervalMs?: number
  } = {}): Promise<PartnerLifecycleResponse> {
    const attempts = options.attempts ?? 12
    const intervalMs = options.intervalMs ?? 1000
    let latest: PartnerLifecycleResponse | null = null

    for (let attempt = 0; attempt < attempts; attempt++) {
      latest = await getUserLifecycle(userId)
      if (latest.account.status === 'ready')
        return latest
      if (latest.account.status === 'refresh_missing' || latest.account.status === 'scope_missing' || latest.account.status === 'reauth_required') {
        throw createError({
          statusCode: 401,
          statusMessage: 'GSCDUMP_REAUTH_REQUIRED',
          message: 'Google Search Console authorization must be refreshed',
          data: latest.account,
        })
      }
      if (latest.account.status === 'disconnected' || latest.account.status === 'oauth_received') {
        throw createError({
          statusCode: 409,
          statusMessage: 'GSCDUMP_NOT_CONNECTED',
          message: 'gscdump user is not fully connected',
          data: latest.account,
        })
      }
      if (attempt < attempts - 1)
        await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw createError({
      statusCode: 409,
      statusMessage: 'GSCDUMP_USER_PROVISIONING',
      message: 'gscdump user database is still provisioning',
      data: latest,
    })
  }

  async function getAnalysis(siteId: string, params: GscdumpAnalysisParams): Promise<GscdumpAnalysisResponse> {
    if ((params.preset === 'non-brand' || params.preset === 'brand-only') && !params.brandTerms?.trim()) {
      throw createError({
        statusCode: 400,
        message: 'brandTerms is required for brand/non-brand presets',
      })
    }
    return client.getSiteAnalysis({ params: { siteId }, query: params })
      .then(response => response.data as unknown as GscdumpAnalysisResponse)
      .catch(rethrowV1AsH3)
  }

  return {
    // User management
    registerUser: (body: RegisterPartnerUserParams) =>
      client.createUser({ body }).then(response => response.data).catch(rethrowV1AsH3),
    updateUserTokens: (userId: string, body: UpdatePartnerUserTokensParams) =>
      client.updateUserTokens({ params: { userId }, body }).then(response => response.data).catch(rethrowV1AsH3),
    getUserLifecycle,
    getSiteSyncStatus,
    waitForUserReady,
    getAvailableSites: (userId: string) =>
      client.listAvailableSites({ params: { userId }, query: {} }).then(response => response.data).catch(rethrowV1AsH3),

    getUserEntitlements: (userId: string): Promise<PartnerUserEntitlementsV1> =>
      client.getUserEntitlements({ params: { userId } }).then(response => response.data).catch(rethrowV1AsH3),

    // Site management
    registerSite: (params: {
      userId: string
      siteUrl?: string
      requestedUrl?: string
      gscPropertyUrl?: string
      webhookUrl?: string
    }): Promise<SiteRegistrationResult> =>
      client.createSite({
        params: { userId: params.userId },
        body: {
          siteUrl: (params.requestedUrl || params.siteUrl)!,
          ...(params.requestedUrl && { requestedUrl: params.requestedUrl }),
          ...(params.gscPropertyUrl && { gscPropertyUrl: params.gscPropertyUrl }),
          ...(params.webhookUrl && { webhookUrl: params.webhookUrl }),
          webhookEvents: [...SITE_WEBHOOK_EVENTS],
        },
      }).then((response): SiteRegistrationResult => ({ _tag: 'Registered', registration: response.data })).catch((err: unknown) => {
        const refusal = isGscdumpV1Error(err) ? parseEntitlementRefusal(err.details) : null
        if (refusal)
          return { _tag: 'Refused', refusal } satisfies SiteRegistrationResult
        return rethrowV1AsH3(err)
      }),
    deleteSite: (siteId: string) =>
      client.deleteSite({ params: { siteId } }).then(response => response.data).catch(rethrowV1AsH3),
    // The IndexNow connection read is the cheapest Site read on the partner
    // surface. Its authorization is the answer; the body is not used.
    readSiteAccess: (siteId: string): Promise<GscdumpSiteAccess> =>
      client.getSiteIndexNowConnection({ params: { siteId } })
        .then((): GscdumpSiteAccess => ({ _tag: 'Readable' }))
        .catch((err: unknown) => {
          if (isGscdumpV1Error(err) && err.code === 'site_not_found')
            return { _tag: 'NotFound' } satisfies GscdumpSiteAccess
          return rethrowV1AsH3(err)
        }),

    // Analytics
    getData: (siteId: string, state: BuilderStateWire, queryOptions?: DataQueryOptions): Promise<GscdumpDataResponse> =>
      client.queryAnalyticsReport({
        params: { siteId },
        body: {
          state: toV1ReportState(state, queryOptions?.searchType),
          ...(queryOptions?.comparison ? { comparison: toV1ReportState(queryOptions.comparison, queryOptions.searchType) } : {}),
          ...(queryOptions?.filter ? { filter: queryOptions.filter } : {}),
        },
      }).then(response => response.data as unknown as GscdumpDataResponse).catch(rethrowV1AsH3),
    getDataDetail: (siteId: string, state: BuilderStateWire, queryOptions?: DataDetailOptions): Promise<GscdumpDataDetailResponse> =>
      client.queryAnalyticsReportDetail({
        params: { siteId },
        body: {
          state: toV1ReportState(state, queryOptions?.searchType),
          ...(queryOptions?.comparison ? { comparison: toV1ReportState(queryOptions.comparison, queryOptions.searchType) } : {}),
        },
      }).then(response => response.data as unknown as GscdumpDataDetailResponse).catch(rethrowV1AsH3),
    getAnalysis,

    // Sitemaps: all v1 since `partner.sites.sitemaps.action.create` (submit/delete/refresh).
    getSitemaps: (siteId: string) =>
      client.getSiteSitemaps({ params: { siteId } }).then(response => response.data).catch(rethrowV1AsH3),
    getSitemapChanges: (siteId: string, days = 28) =>
      client.getSiteSitemapChanges({ params: { siteId }, query: { days } }).then(response => response.data).catch(rethrowV1AsH3),
    submitSitemap: (siteId: string, sitemapUrl: string, action: 'submit' | 'delete') =>
      client.createSitemapAction({ params: { siteId }, body: { action, sitemapUrl } })
        .then(response => response.data)
        .catch(rethrowV1AsH3),
    refreshSitemaps: (siteId: string) =>
      client.createSitemapAction({ params: { siteId }, body: { action: 'refresh' } })
        .then(response => response.data)
        .catch(rethrowV1AsH3),

    // Indexing
    getIndexing: (siteId: string, days = 28) =>
      client.getSiteIndexing({ params: { siteId }, query: { days } }).then(response => response.data).catch(rethrowV1AsH3),
    getIndexingUrls: (siteId: string, query: IndexingUrlsParams = {}) =>
      client.listSiteIndexingUrls({ params: { siteId }, query }).then(response => response.data).catch(rethrowV1AsH3),
    getIndexingDiagnostics: (siteId: string, query: IndexingDiagnosticsParams = {}) =>
      client.getSiteIndexingDiagnostics({ params: { siteId }, query }).then(response => response.data).catch(rethrowV1AsH3),
  }
}
