import type { PartnerLifecycleSite } from '#layers/pro-gsc/shared/gscdump-api'
import { GSC_STABLE_LATENCY_DAYS } from '@gscdump/sdk/gsc-constants'
import { subDays } from 'date-fns'
import { eq } from 'drizzle-orm'
import { matchGscSite, normalizeRegistrationTarget, toIsoDate } from 'gscdump'
import { getQuery } from 'h3'
import { logger } from '~~/shared/server/logger'
import { analyticsStatusToSyncStatus, findLifecycleSite, useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { hasGscdumpConnection, readSearchConsoleProperties } from '#layers/pro-gsc/server/utils/search-console-properties'
// TODO(pro-saas-cleanup): re-wire stats fetch when V1 site-signals lands.
// The old `#layers/pro-saas/server/utils/site-signals` was deleted in Phase 1.
import { sites } from '#layers/pro-saas/server/database'
import { readCallerGscdumpConnection } from '#layers/pro-saas/server/utils/caller-rows'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Messages ported from nuxtseo.com `layers/pro/gsc/server/utils/build-gsc-properties.ts`.
export function lifecycleAccountError(status: string): GscPropertiesResponse['error'] | null {
  switch (status) {
    case 'db_provisioning':
      return { reason: 'USER_PROVISIONING', message: 'Request Indexing is preparing your Search Console data. Try again in a moment.' }
    case 'refresh_missing':
      return { reason: 'MISSING_REFRESH_TOKEN', message: 'Google could not keep this connection active. Reconnect Search Console.' }
    case 'scope_missing':
      return { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', message: 'Search Console access was not approved. Reconnect Google and allow Search Console access.' }
    case 'reauth_required':
      return { reason: 'AUTH_EXPIRED', message: 'Your Google connection has expired. Reconnect Search Console.' }
    case 'disconnected':
    case 'oauth_received':
      return { reason: 'GSCDUMP_NOT_CONNECTED', message: 'Search Console is not connected yet. Reconnect Google to finish setup.' }
    default:
      return null
  }
}

export function lifecycleSyncStatus(site: PartnerLifecycleSite) {
  return analyticsStatusToSyncStatus(site.analytics.status)
}

export interface GscPropertiesResponse {
  /** This app holds a gscdump connection for the caller. gscdump holds the Google grant. */
  connected: boolean
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

// The picker's Refresh asks for `?refresh=1`: gscdump then reads Google live
// instead of its stored copy of the list, as nuxtseo.com's
// `/api/pro/gsc-available-properties?refresh=1` does.
export default defineProApiHandler({ team: true }, async ({ event, team: ctx }): Promise<GscPropertiesResponse> => {
  const db = ctx.db
  const refreshParam = getQuery(event).refresh
  const refresh = refreshParam === '1' || refreshParam === 'true'

  // The caller batch already read the user row, so the connection costs no
  // D1 round trip here.
  const dbUser = await readCallerGscdumpConnection(event, db, ctx.caller.user.id)

  // Every site the caller's current team owns. This used to list the caller's
  // own sites, so a teammate's site never appeared in the property matcher.
  async function readTeamSites() {
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
    return userSites
      .filter(s => s.url)
      .map(s => ({
        siteId: s.id,
        siteName: s.name,
        siteUrl: s.url!,
        domain: normalizeRegistrationTarget(s.url!) ?? s.url!,
        gscdumpSiteId: s.gscdumpSiteId,
        gscdumpSiteUrl: s.gscdumpSiteUrl,
      }))
  }

  // The connection is the gscdump user and key, the same predicate the session
  // publishes. It used to be a `google_accounts` row, which the Search Console
  // callback never writes, so most accounts read as not connected here.
  if (!hasGscdumpConnection(dbUser))
    return { connected: false, properties: [], userSites: await readTeamSites() }

  if (import.meta.dev && dbUser.gscdumpUserId === 'e2e-demo-user') {
    const siteDomains = await readTeamSites()
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

  // The Team's Sites, the lifecycle, and the property list do not depend on
  // each other, so all three run at once. They used to run one after the
  // other: the 2026-10-01 replay measured 4.0 to 6.2 s per read, with the
  // lifecycle at 0.9 to 1.4 s and the list at about 1.6 s. An account error
  // from the lifecycle still decides the answer below, whatever the list says.
  const gscdump = useGscdumpClient()
  const [siteDomains, lifecycle, availableRead] = await Promise.all([
    readTeamSites(),
    gscdump.getUserLifecycle(dbUser.gscdumpUserId).catch((err) => {
      logger.warn('[gsc-properties] gscdump lifecycle error:', err?.data?.message || err?.message)
      return null
    }),
    // A failed read is an error the reader sees, never an empty list. An empty
    // list reads as "this Google account has no property", which is a
    // different instruction.
    readSearchConsoleProperties(dbUser, () => gscdump, { refresh }),
  ])
  if (!lifecycle) {
    return {
      connected: true,
      properties: [],
      userSites: siteDomains,
      error: { reason: 'GSCDUMP_ERROR', message: 'Request Indexing could not read your Search Console properties. Try again shortly.' },
    }
  }

  const accountError = lifecycleAccountError(lifecycle.account.status)
  if (accountError) {
    return {
      connected: true,
      properties: [],
      userSites: siteDomains,
      error: accountError,
    }
  }

  if (availableRead._tag !== 'Loaded') {
    logger.warn('[gsc-properties] gscdump available-sites error:', availableRead._tag === 'Unavailable' ? availableRead.reason : availableRead._tag)
    return {
      connected: true,
      properties: [],
      userSites: siteDomains,
      error: { reason: 'GSCDUMP_ERROR', message: 'Request Indexing could not read your Search Console properties. Try again.' },
    }
  }
  const availableSitesRes = { sites: availableRead.properties }

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
