import type { PartnerLifecycleSite } from '#layers/pro-gsc/shared/gscdump-api'
import { GSC_STABLE_LATENCY_DAYS } from '@gscdump/sdk/gsc-constants'
import { subDays } from 'date-fns'
import { eq } from 'drizzle-orm'
import { matchGscSite, normalizeRegistrationTarget, toIsoDate } from 'gscdump'
import { logger } from '~~/shared/server/logger'
import { analyticsStatusToSyncStatus, findLifecycleSite, useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
// TODO(pro-saas-cleanup): re-wire stats fetch when V1 site-signals lands.
// The old `#layers/pro-saas/server/utils/site-signals` was deleted in Phase 1.
import { googleAccounts, sites, users } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

export function lifecycleAccountError(status: string): GscPropertiesResponse['error'] | null {
  switch (status) {
    case 'db_provisioning':
      return { reason: 'USER_PROVISIONING', message: 'Search Console data is still being prepared. Please try again shortly.' }
    case 'refresh_missing':
      return { reason: 'MISSING_REFRESH_TOKEN', message: 'Google did not return a refresh token. Please reconnect Google Search Console.' }
    case 'scope_missing':
      return { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', message: 'Google Search Console permission not granted. Please re-authorize to grant access.' }
    case 'reauth_required':
      return { reason: 'AUTH_EXPIRED', message: 'Google connection expired. Please reconnect your Google account.' }
    case 'disconnected':
    case 'oauth_received':
      return { reason: 'GSCDUMP_NOT_CONNECTED', message: 'Google Search Console is not connected yet. Please reconnect your Google account.' }
    default:
      return null
  }
}

export function lifecycleSyncStatus(site: PartnerLifecycleSite) {
  return analyticsStatusToSyncStatus(site.analytics.status)
}

export interface GscPropertiesResponse {
  connected: boolean
  gscdumpRegistered?: boolean
  gscEmail?: string | null
  googleScopes?: string | null
  properties: Array<Record<string, unknown>>
  userSites?: Array<Record<string, unknown>>
  error?: { reason: string, message: string }
  stats?: {
    total: number
    synced: number
    syncing: number
    pending: number
    readyToSync: number
  }
}

export default defineProApiHandler({ team: true }, async ({ team: ctx }): Promise<GscPropertiesResponse> => {
  const db = ctx.db

  // V1: gsc connection state lives on `google_accounts` rows of type 'auth'
  // (and 'indexing'). Pull both: existence implies "connected"; payload carries
  // identity, tokens carry scopes.
  const [dbUser] = await db
    .select({
      gscdumpUserId: users.gscdumpUserId,
    })
    .from(users)
    .where(eq(users.userId, ctx.caller.user.id))

  const gscAccount = await db
    .select()
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, ctx.caller.user.id))
    .get()

  const gscConnected = !!gscAccount
  const gscEmail = (gscAccount?.payload as { email?: string | null } | undefined)?.email ?? null
  const googleScopes = gscAccount?.tokens?.scope ?? null

  if (!gscConnected)
    return { connected: false, properties: [] }

  // Every site the caller's current team owns. This used to list the caller's
  // own sites, so a teammate's site never appeared in the property matcher.
  const userSites = await db
    .select({
      id: sites.id,
      url: sites.property,
      name: sites.property,
      gscdumpSiteId: sites.gscdumpSiteId,
      gscdumpSiteUrl: sites.gscdumpSiteUrl,
    })
    .from(sites)
    .where(eq(sites.teamId, ctx.team.teamId))

  // Build domain lookup for matching
  const siteDomains = userSites
    .filter(s => s.url)
    .map(s => ({
      siteId: s.id,
      siteName: s.name,
      siteUrl: s.url!,
      domain: normalizeRegistrationTarget(s.url!) ?? s.url!,
      gscdumpSiteId: s.gscdumpSiteId,
      gscdumpSiteUrl: s.gscdumpSiteUrl,
    }))

  if (import.meta.dev && dbUser?.gscdumpUserId === 'e2e-demo-user') {
    const properties = siteDomains.map(site => ({
      siteUrl: site.gscdumpSiteUrl || site.domain,
      permissionLevel: 'siteOwner',
      matchingSite: {
        siteId: site.siteId,
        siteName: site.siteName,
        siteUrl: site.siteUrl,
        gscdumpSiteId: site.gscdumpSiteId,
      },
      syncStatus: site.gscdumpSiteId ? 'synced' : null,
      syncProgress: site.gscdumpSiteId ? { completed: 30, total: 30, percent: 100 } : null,
      lastSyncAt: new Date().toISOString(),
      newestDateSynced: toIsoDate(subDays(new Date(), GSC_STABLE_LATENCY_DAYS)),
      oldestDateSynced: toIsoDate(subDays(new Date(), 32)),
      canSync: !site.gscdumpSiteId,
      gscdumpSiteId: site.gscdumpSiteId,
      stats: null,
    }))

    return {
      connected: true,
      gscdumpRegistered: true,
      gscEmail,
      googleScopes,
      properties,
      userSites: siteDomains,
      stats: {
        total: properties.length,
        synced: properties.filter(p => p.syncStatus === 'synced').length,
        syncing: 0,
        pending: 0,
        readyToSync: properties.filter(p => p.canSync).length,
      },
    }
  }

  // If no gscdump user ID, return basic info
  if (!dbUser?.gscdumpUserId) {
    return {
      connected: true,
      gscdumpRegistered: false,
      gscEmail,
      googleScopes,
      properties: [],
      userSites: siteDomains,
    }
  }

  // Fetch lifecycle first; picker data is only used to show unregistered GSC properties.
  const gscdump = useGscdumpClient()
  const lifecycle = await gscdump.getUserLifecycle(dbUser?.gscdumpUserId).catch((err) => {
    logger.warn('[gsc-properties] gscdump lifecycle error:', err?.data?.message || err?.message)
    return null
  })
  if (!lifecycle) {
    return {
      connected: true,
      gscdumpRegistered: true,
      gscEmail,
      googleScopes,
      properties: [],
      userSites: siteDomains,
      error: { reason: 'GSCDUMP_ERROR', message: 'Could not fetch Search Console properties. Please try again or reconnect your Google account.' },
    }
  }

  const accountError = lifecycleAccountError(lifecycle.account.status)
  if (accountError) {
    return {
      connected: true,
      gscdumpRegistered: true,
      gscEmail,
      googleScopes,
      properties: [],
      userSites: siteDomains,
      error: accountError,
    }
  }

  const availableSitesRes = await gscdump.getAvailableSites(dbUser?.gscdumpUserId)
    .catch((err) => {
      const reason = err?.data?.reason || err?.data?.error?.reason
      const status = err?.statusCode || err?.status || 500
      logger.warn('[gsc-properties] gscdump available-sites error:', status, reason, err?.data?.message || err?.message)
      return { sites: [] }
    })

  const seenLifecycleSiteIds = new Set<string>()

  const properties = availableSitesRes.sites.map((prop) => {
    const matchingSite = siteDomains.find(sd => matchGscSite(sd.siteUrl, prop.siteUrl))
    const lifecycleSite = findLifecycleSite(lifecycle, matchingSite?.gscdumpSiteId || prop.siteId || prop.siteUrl)
    if (lifecycleSite)
      seenLifecycleSiteIds.add(lifecycleSite.siteId)

    return {
      siteUrl: prop.siteUrl,
      permissionLevel: prop.permissionLevel,
      matchingSite: matchingSite
        ? {
            siteId: matchingSite.siteId,
            siteName: matchingSite.siteName,
            siteUrl: matchingSite.siteUrl,
            gscdumpSiteId: matchingSite.gscdumpSiteId,
          }
        : null,
      syncStatus: lifecycleSite ? lifecycleSyncStatus(lifecycleSite) : prop.syncStatus || (prop.registered || matchingSite?.gscdumpSiteId ? 'pending' : null),
      syncProgress: lifecycleSite?.analytics.progress || prop.syncProgress,
      lastSyncAt: lifecycleSite?.updatedAt ? Date.parse(lifecycleSite.updatedAt) : prop.lastSyncAt,
      newestDateSynced: lifecycleSite?.analytics.syncedRange.newest ?? prop.newestDateSynced,
      oldestDateSynced: lifecycleSite?.analytics.syncedRange.oldest ?? prop.oldestDateSynced,
      analytics: lifecycleSite?.analytics,
      sitemaps: lifecycleSite?.sitemaps,
      indexingEligible: lifecycleSite?.indexing.eligible,
      indexingIneligibleReason: lifecycleSite?.indexing.reason,
      indexingPermissionLevel: lifecycleSite?.permissionLevel,
      indexingStatus: lifecycleSite?.indexing.status,
      indexingProgress: lifecycleSite?.indexing.progress,
      latestError: lifecycleSite?.latestError ?? null,
      canSync: !!matchingSite && !matchingSite.gscdumpSiteId && !prop.registered,
      gscdumpSiteId: lifecycleSite?.siteId || matchingSite?.gscdumpSiteId || prop.siteId,
    }
  })

  for (const lifecycleSite of lifecycle.sites) {
    if (seenLifecycleSiteIds.has(lifecycleSite.siteId))
      continue
    const propUrl = lifecycleSite.gscPropertyUrl || lifecycleSite.requestedUrl
    const matchingSite = siteDomains.find(sd =>
      sd.gscdumpSiteId === lifecycleSite.siteId
      || matchGscSite(sd.siteUrl, propUrl)
      || (sd.gscdumpSiteUrl != null && matchGscSite(sd.gscdumpSiteUrl, propUrl)),
    )
    properties.push({
      siteUrl: propUrl,
      permissionLevel: lifecycleSite.permissionLevel || '',
      matchingSite: matchingSite
        ? {
            siteId: matchingSite.siteId,
            siteName: matchingSite.siteName,
            siteUrl: matchingSite.siteUrl,
            gscdumpSiteId: matchingSite.gscdumpSiteId,
          }
        : null,
      syncStatus: lifecycleSyncStatus(lifecycleSite),
      syncProgress: lifecycleSite.analytics.progress,
      lastSyncAt: lifecycleSite.updatedAt ? Date.parse(lifecycleSite.updatedAt) : null,
      newestDateSynced: lifecycleSite.analytics.syncedRange.newest,
      oldestDateSynced: lifecycleSite.analytics.syncedRange.oldest,
      analytics: lifecycleSite.analytics,
      sitemaps: lifecycleSite.sitemaps,
      indexingEligible: lifecycleSite.indexing.eligible,
      indexingIneligibleReason: lifecycleSite.indexing.reason,
      indexingPermissionLevel: lifecycleSite.permissionLevel,
      indexingStatus: lifecycleSite.indexing.status,
      indexingProgress: lifecycleSite.indexing.progress,
      latestError: lifecycleSite.latestError,
      canSync: false,
      gscdumpSiteId: lifecycleSite.siteId,
    })
  }

  // Stats fetching stubbed pending V1 site-signals replacement.
  // See TODO at top of file.
  const statsMap = new Map<string, null>()

  // Merge stats into properties
  const propertiesWithStats = properties.map(p => ({
    ...p,
    stats: statsMap.get(p.siteUrl) || null,
  }))

  return {
    connected: true,
    gscdumpRegistered: true,
    gscEmail,
    googleScopes,
    properties: propertiesWithStats,
    userSites: siteDomains,
    stats: {
      total: properties.length,
      synced: properties.filter(p => p.syncStatus === 'synced').length,
      syncing: properties.filter(p => p.syncStatus === 'syncing').length,
      pending: properties.filter(p => p.syncStatus === 'pending').length,
      readyToSync: properties.filter(p => p.canSync).length,
    },
  }
})
