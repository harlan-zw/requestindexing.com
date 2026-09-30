import { and, eq, inArray, or } from 'drizzle-orm'
import { googleAccounts, sites, teams } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { relinkTeamSites } from '#layers/pro-saas/server/utils/site-rows'
import { resolveSiteSelection } from '#layers/pro-saas/server/utils/site-selection'
import { ProError } from '#layers/pro-saas/shared/errors'
import { teamsCallerCan } from '#layers/pro-saas/shared/policies/team-policy'
import { teamSitesUpdateSchema } from '#layers/pro-saas/shared/validators/teams'

// Persist the team's selected Search Console sites + backup preference.
// `team_sites` requires a `googleAccountId`, so we resolve one of the caller's
// own linked Google accounts to satisfy it.
//
// Onboarding completion is not written here any more. It is user scoped and
// `POST /api/pro/onboarding/complete` owns it, so a team settings save can no
// longer close a user's setup gate as a side effect.
export default defineProApiHandler({
  team: { ability: 'manage-sites' },
  body: teamSitesUpdateSchema,
}, async ({ db, caller, team: ctx, body }) => {
  const { backupsEnabled, selectedSites } = body

  // Sites are team scoped, so the picker may only name a site this team
  // already owns or one the caller created on another team they manage.
  // Selecting such a site moves it onto this team, which is what picking it
  // means. `owner_id` alone grants nothing: a member removed from a team
  // could otherwise move its Sites away.
  const found = selectedSites.length
    ? await db.select({ id: sites.id, publicId: sites.publicId })
        .from(sites)
        .where(and(inArray(sites.publicId, selectedSites), or(
          eq(sites.teamId, ctx.team.teamId),
          and(eq(sites.ownerId, caller.user.id), inArray(sites.teamId, teamsCallerCan(caller, 'manage-sites'))),
        )))
        .all()
    : []
  // A selection naming a site this caller cannot pick is a bad request, not
  // a partial save. Dropping unknown ids once cleared every link on a team.
  const selection = resolveSiteSelection(selectedSites, found)
  if (selection._tag === 'UnknownSites') {
    throw new ProError('validation_failed', {
      message: `Unknown sites: ${selection.unknown.join(', ')}`,
    })
  }
  const siteIds = selection.siteIds

  let googleAccountId: number | null = null
  if (siteIds.length) {
    const account = await db.select({ id: googleAccounts.googleAccountId })
      .from(googleAccounts)
      .where(eq(googleAccounts.userId, caller.user.id))
      .orderBy(googleAccounts.googleAccountId)
      .get()
    if (!account)
      throw new ProError('validation_failed', { message: 'Connect a Google account before selecting sites' })
    googleAccountId = account.id
  }

  await db.update(teams).set({
    backupsEnabled: backupsEnabled === undefined ? ctx.team.backupsEnabled : (backupsEnabled ? 1 : 0),
    updatedAt: Date.now(),
  }).where(eq(teams.teamId, ctx.team.teamId))

  await relinkTeamSites(db, { teamId: ctx.team.teamId, siteIds, googleAccountId })

  return {
    teamId: ctx.team.teamId,
    backupsEnabled: backupsEnabled ?? !!ctx.team.backupsEnabled,
    sitesSelected: siteIds.length,
  }
})
