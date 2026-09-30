// A Site gscdump refused to register waits for its user.
//
// A full Free allowance or a property that is already a Site does not change
// by itself, so asking again only spends the shared `partner.users.sites.create`
// budget. `autoLinkGsc` records the refusal as `gscdump_sync_status = 'refused'`,
// the hourly reconcile skips those Sites, and a user action releases them:
// removing a Site, or reconnecting Google.
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { sites } from '#layers/pro-saas/server/database'

type Db = ReturnType<typeof useDrizzle>

export const REFUSED_SYNC_STATUS = 'refused' as const

/** The SQL condition for a Site that is not waiting on a refusal. */
export function notRefused() {
  return or(isNull(sites.gscdumpSyncStatus), ne(sites.gscdumpSyncStatus, REFUSED_SYNC_STATUS))
}

export async function markSiteRefused(db: Db, siteId: string): Promise<void> {
  await db.update(sites)
    .set({ gscdumpSyncStatus: REFUSED_SYNC_STATUS })
    .where(and(eq(sites.id, siteId), isNull(sites.gscdumpSiteId)))
}

/**
 * Let the next reconcile try refused Sites again. Called after the user acts:
 * a Site removed may free a place in the Free allowance, and a reconnect may
 * change which properties the grant covers. Scope it to the Teams the action
 * touched and the Sites the user created.
 */
export async function releaseRefusedSites(db: Db, scope: { teamIds: number[], ownerId: number }): Promise<void> {
  await db.update(sites)
    .set({ gscdumpSyncStatus: null })
    .where(and(
      eq(sites.gscdumpSyncStatus, REFUSED_SYNC_STATUS),
      isNull(sites.gscdumpSiteId),
      scope.teamIds.length
        ? or(inArray(sites.teamId, scope.teamIds), eq(sites.ownerId, scope.ownerId))
        : eq(sites.ownerId, scope.ownerId),
    ))
}
