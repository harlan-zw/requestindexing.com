// A Site letting go of its gscdump Site.
//
// The partner `deleteSite` erases a gscdump Site for every tenant, and
// `autoLinkGsc` reuses a registered gscdump Site, so Sites on two teams can
// hold the same id. Deleting it because one of them let go erased the other
// team's Search Console data. The gscdump Site goes only with the last local
// Site that links to it. `deleteTeam` applies the same rule to a whole team.
import { and, eq, ne } from 'drizzle-orm'
import { sites } from '#layers/pro-saas/server/database'
import { assertLocalRegisteredGscSiteScope } from './registered-site-scope'

type Db = ReturnType<typeof useDrizzle>

export type GscdumpSiteRelease
  = | { _tag: 'Deleted' }
    | { _tag: 'AlreadyAbsent' }
    /** Another local Site still links to it, so gscdump keeps it. */
    | { _tag: 'StillLinked' }

export async function releaseGscdumpSite(
  db: Db,
  release: { siteId: string, gscdumpSiteId: string, siteUrl: string },
  deleteSite: (gscdumpSiteId: string) => Promise<unknown>,
  readLifecycle: Parameters<typeof assertLocalRegisteredGscSiteScope>[3],
): Promise<GscdumpSiteRelease> {
  const otherLink = await db.select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.gscdumpSiteId, release.gscdumpSiteId), ne(sites.id, release.siteId)))
    .limit(1)
    .get()
  if (otherLink)
    return { _tag: 'StillLinked' }
  const admission = await assertLocalRegisteredGscSiteScope(db, release.siteId, release.gscdumpSiteId, readLifecycle, release.siteUrl, 'delete')
  if (admission._tag === 'Absent')
    return { _tag: 'AlreadyAbsent' }
  await deleteSite(release.gscdumpSiteId)
  return { _tag: 'Deleted' }
}
