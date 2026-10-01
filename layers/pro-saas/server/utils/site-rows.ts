import { and, eq, inArray, ne, or } from 'drizzle-orm'
import {
  indexingInvestigations,
  sites,
  teamSites,
  usages,
  userSites,
} from '~~/layers/core/server/db/schema'

type Db = ReturnType<typeof useDrizzle>

// D1 does not run FK cascades, so every table referencing `sites.id` is
// purged here, children before the `sites` row. One place owns the list so
// site delete and team delete cannot drift apart. `jobs` tables carry a bare
// non-FK `site_id` for queue bookkeeping and are left alone on purpose.
export async function purgeSiteChildren(db: Db, siteIds: readonly string[]): Promise<void> {
  if (!siteIds.length)
    return
  const ids = [...siteIds]
  await db.delete(usages).where(inArray(usages.siteId, ids))
  await db.delete(userSites).where(inArray(userSites.siteId, ids))
  await db.delete(teamSites).where(inArray(teamSites.siteId, ids))
  await db.delete(indexingInvestigations).where(inArray(indexingInvestigations.siteId, ids))
}

// Deletes the team's sites with their child rows. Returns the ids removed.
export async function purgeTeamSites(db: Db, teamId: number): Promise<string[]> {
  const rows = await db.select({ id: sites.id }).from(sites).where(eq(sites.teamId, teamId)).all()
  const ids = rows.map(row => row.id)
  await purgeSiteChildren(db, ids)
  if (ids.length)
    await db.delete(sites).where(inArray(sites.id, ids))
  return ids
}

// Makes `siteIds` exactly the team's linked sites. A site moving onto this
// team loses its link row on every other team in the same call, so
// `team_sites` never carries a row for a team the site no longer belongs to.
export async function relinkTeamSites(db: Db, input: {
  teamId: number
  siteIds: readonly string[]
  googleAccountId: number | null
}): Promise<void> {
  const ids = [...input.siteIds]
  await db.delete(teamSites).where(ids.length
    ? or(eq(teamSites.teamId, input.teamId), inArray(teamSites.siteId, ids))
    : eq(teamSites.teamId, input.teamId))
  const googleAccountId = input.googleAccountId
  if (!ids.length || googleAccountId === null)
    return
  await db.update(sites)
    .set({ teamId: input.teamId })
    .where(and(inArray(sites.id, ids), ne(sites.teamId, input.teamId)))
  await db.insert(teamSites).values(ids.map(siteId => ({
    teamId: input.teamId,
    siteId,
    googleAccountId,
  })))
}
