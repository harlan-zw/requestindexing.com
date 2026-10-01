// Connected Sites and the Site allowance for `ProSiteAddForm`, plus the
// read-only list on Team settings. Lists the caller's current team's sites,
// plus any they created on another team they manage.
// Sync status/progress comes from gscdump's lifecycle;
// `pageCount30Day` is a real per-site page count pulled from gscdump `getData`
// (not fabricated), bounded to synced sites only.
import { and, eq, inArray, or } from 'drizzle-orm'
import { between, date, daysAgo, gsc, page, today } from 'gscdump/query'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readOptionalUserEntitlements } from '#layers/pro-gsc/server/utils/user-entitlements'
import { siteAllowanceOf } from '#layers/pro-gsc/shared/free-allowance'
import { sites } from '#layers/pro-saas/server/database'
import { readCallerGscdumpUserId } from '#layers/pro-saas/server/utils/caller-rows'
import { defineProApiHandler, getProLogger } from '#layers/pro-saas/server/utils/handler'
import { teamsCallerCan } from '#layers/pro-saas/shared/policies/team-policy'
import { isNearRetentionLimit, lifecycleOf, lifecycleSiteFor, readOptionalUserLifecycle, syncStatusFor } from '../../utils/site-lifecycle'

// Real per-site page count over the trailing 30 days (`limit(1)`: we only
// need `totalCount` from the response, not the rows themselves).
const pageCountState = gsc.select(page).where(between(date, daysAgo(30), today())).limit(1).getState()

export default defineProApiHandler({}, async ({ db, caller, event }) => {
  // A Site the caller created elsewhere is offered only while they can still
  // manage that team's Sites. `owner_id` records the creator and grants nothing.
  const createdByCaller = and(
    eq(sites.ownerId, caller.user.id),
    inArray(sites.teamId, teamsCallerCan(caller, 'manage-sites')),
  )
  // The caller batch already read the user row, so this costs no D1 round trip.
  const gscdumpUserId = await readCallerGscdumpUserId(event, db, caller.user.id)

  // The client is built inside the read, so a caller gscdump does not know and
  // a partner key that will not build both land on the stored sync status
  // instead of a 500. Guarding only on `gscdumpUserId` used to leave the second
  // case open: `useGscdumpClient` throws before any promise exists, and the
  // onboarding "Connect your sites" step then read the caller's existing sites
  // as zero and could not be finished.
  //
  // The Sites read does not depend on gscdump, so it runs beside the two
  // gscdump reads. Connect a Site waits on this route and the property list.
  const [ownedSites, lifecycleRead, entitlementsRead] = await Promise.all([
    db.select().from(sites).where(and(
      caller.currentTeamId
        ? or(eq(sites.teamId, caller.currentTeamId), createdByCaller)
        : createdByCaller,
      eq(sites.active, true),
    )).all(),
    readOptionalUserLifecycle(gscdumpUserId, useGscdumpClient),
    readOptionalUserEntitlements(gscdumpUserId, useGscdumpClient),
  ])
  if (lifecycleRead._tag === 'Unavailable')
    getProLogger(event).warn('[sites/preview] gscdump lifecycle unavailable:', lifecycleRead.reason)
  if (entitlementsRead._tag === 'Unavailable')
    getProLogger(event).warn('[sites/preview] gscdump entitlements unavailable:', entitlementsRead.reason)
  const lifecycle = lifecycleOf(lifecycleRead)

  const previews = await Promise.all(ownedSites.map(async (site) => {
    const lifecycleSite = lifecycleSiteFor(lifecycle, site.gscdumpSiteId)
    const syncStatus = syncStatusFor(lifecycleSite, site.gscdumpSyncStatus)
    const oldest = lifecycleSite?.analytics.syncedRange.oldest ?? null

    const pageCount30Day = (lifecycleRead._tag === 'Loaded' && site.gscdumpSiteId && lifecycleSite?.analytics.queryable)
      ? await lifecycleRead.reader.getData(site.gscdumpSiteId, pageCountState).then(r => r.totalCount).catch(() => 0)
      : 0

    return {
      site,
      syncStatus,
      preview: {
        sitemaps: site.sitemaps ?? [],
        siteId: site.publicId,
        domain: site.domain,
        // `sites.domain` is null on rows imported from the old KV store. The
        // Search Console property is the only label those rows carry, so it
        // ships with the preview and `siteLabel()` falls back to it.
        property: site.property,
        pageCount30Day,
        startOfData: oldest,
        isLosingData: isNearRetentionLimit(oldest),
      },
    }
  }))

  const stillSyncing = previews.some(p => p.syncStatus === 'pending' || p.syncStatus === 'syncing')

  return {
    sites: previews.map(p => p.preview),
    jobStatus: !lifecycle ? 'pending' : (stillSyncing ? 'pending' : 'ready'),
    // gscdump's Site allowance for the caller. `Uncapped` while the partner is
    // exempt, so the connect flow shows no count and no cap.
    siteAllowance: siteAllowanceOf(entitlementsRead),
  }
})
