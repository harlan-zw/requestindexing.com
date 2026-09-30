// A Site links only to a gscdump Site that this app's partner key can read.
//
// gscdump scopes every partner Site read to the partner that registered the
// Site. Before gscdump.com registered Sites per Usage pool, a registration
// could answer with a Site that nuxtseo.com or gscdump.com had registered for
// the same Google account. This app stored that id, every read of it answered
// 404, and the Site never got data or counted in this app's pool.
import type { GscdumpSiteAccess } from './gscdump-client'
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { sites } from '#layers/pro-saas/server/database'

type Db = ReturnType<typeof useDrizzle>

/**
 * The SQL condition for a linked Site that gscdump has not reported on yet.
 * gscdump sends webhooks for a Site this partner can read, so its status moves
 * past `pending`. A Site linked to another pool's Site never moves.
 */
export function unreportedGscdumpLink() {
  return and(
    isNotNull(sites.gscdumpSiteId),
    or(isNull(sites.gscdumpSyncStatus), eq(sites.gscdumpSyncStatus, 'pending')),
  )
}

/**
 * Unlink every unreported Site of a Team whose gscdump Site this partner cannot
 * read, so the reconcile links it again in this partner's pool. Returns the
 * number of gscdump Sites unlinked.
 */
export async function unlinkUnreadableGscdumpSites(opts: {
  db: Db
  teamId: number
  /** gscdump Sites in the reconciling user's lifecycle. This partner can read them. */
  readableSiteIds: ReadonlySet<string>
  readSiteAccess: (gscdumpSiteId: string) => Promise<GscdumpSiteAccess>
}): Promise<number> {
  const { db, teamId, readableSiteIds, readSiteAccess } = opts
  const linked = await db.select({ gscdumpSiteId: sites.gscdumpSiteId })
    .from(sites)
    .where(and(eq(sites.teamId, teamId), unreportedGscdumpLink()))

  // Another member's Site is readable but absent from this user's lifecycle,
  // so only a Site read can tell it apart from another pool's Site.
  const unknown = [...new Set(linked.map(site => site.gscdumpSiteId!))].filter(id => !readableSiteIds.has(id))
  let unlinked = 0
  for (const gscdumpSiteId of unknown) {
    const access = await readSiteAccess(gscdumpSiteId).catch((err: unknown) => {
      // Keep the link. The next reconcile asks again.
      logWarn('gscdump.site_access.read_failed', err, { gscdumpSiteId })
      return null
    })
    if (access?._tag !== 'NotFound')
      continue
    await db.update(sites)
      .set({ gscdumpSiteId: null, gscdumpSiteUrl: null, gscdumpSyncStatus: null })
      .where(and(eq(sites.teamId, teamId), eq(sites.gscdumpSiteId, gscdumpSiteId)))
    unlinked++
  }
  return unlinked
}
