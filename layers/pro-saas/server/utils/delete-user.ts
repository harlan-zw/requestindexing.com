// Comprehensive per-user data purge for the pro D1 database.
//
// D1 enforces foreign keys, so cascade declarations alone do not order the
// deletes: every row that references the user, their sites, or their teams
// must be removed before its parent, and the users <-> teams ownership cycle
// (users.current_team_id -> teams, teams.owner_id -> users) must be broken
// before either side can go.
//
// Cross-system side-effects (gscdump partner DELETE, admin audit log) live in
// `pro:user:deleting` (pre, critical) and `pro:user:deleted` (post,
// best-effort) listeners per ADR-0007.
//
// Pass `dryRun: true` to count rows that would be deleted without mutating.
// Returns a per-table summary suitable for storing in an audit log.

import type { H3Event } from 'h3'
import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm'
import { dispatchEvent } from '#domain-events/server'
import {
  adminEvents,
  failedJobs,
  feedback,
  googleAccounts,
  indexingInvestigations,
  indexingJobs,
  jobBatches,
  jobs,
  notifications,
  proEvents,
  sessions,
  siteGroups,
  sites,
  teamAuditEvents,
  teamGscCredentials,
  teamInvitations,
  teamMemberships,
  teams,
  teamSites,
  teamUser,
  telemetryEvents,
  usages,
  userIdentities,
  users,
  userSites,
} from '../database'
import { getProLogger } from './handler'

export interface DeleteUserOptions {
  userId: number
  dryRun?: boolean
}

export interface DeleteUserResult {
  userId: number
  dryRun: boolean
  user: {
    id: number
    name: string | null
    email: string | null
    identities: Array<{ provider: string, email: string | null, displayName: string | null }>
    gscdumpUserId: string | null
  } | null
  deleted: Record<string, number>
  /** True only if the users row was actually removed (or dryRun was set). */
  ok: boolean
  warnings: string[]
}

export async function deleteUserData(event: H3Event, opts: DeleteUserOptions): Promise<DeleteUserResult> {
  const { userId, dryRun = false } = opts
  const db = useDrizzle(event)
  const warnings: string[] = []

  const [user] = await db.select().from(users).where(eq(users.userId, userId)).limit(1)
  if (!user) {
    return {
      userId,
      dryRun,
      user: null,
      deleted: {},
      ok: true, // already gone — treat as success so callers can move on
      warnings: ['User not found'],
    }
  }

  const identityRows = await db.select({
    provider: userIdentities.provider,
    email: userIdentities.email,
    displayName: userIdentities.displayName,
    lastUsedAt: userIdentities.lastUsedAt,
  })
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId))
    .all()
    .catch(() => [])
  const sortedIdentities = [...identityRows].sort(
    (a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0),
  )
  const primaryIdentity = sortedIdentities[0] ?? null
  const primaryEmail = primaryIdentity?.email ?? user.email ?? ''

  // Pre-hook: critical listeners (e.g. gscdump partner DELETE) run BEFORE
  // rows are purged so they can read the canonical row state. A throw here
  // aborts the delete entirely — the caller surfaces it as 5xx.
  if (!dryRun) {
    await dispatchEvent('pro:user:deleting', {
      event,
      userId,
      email: primaryEmail,
      gscdumpUserId: user.gscdumpUserId ?? null,
    })
  }

  // Pre-resolve teams the user owns so cascading children can be scoped explicitly.
  // D1 enforces FKs, so we manually delete every team-scoped child row
  // for owned teams before deleting the team itself.
  const ownedTeamRows = await db.select({ id: teams.teamId }).from(teams).where(eq(teams.ownerId, userId))
  const ownedTeamIds = ownedTeamRows.map(t => t.id)

  // Sites belong to a team, so an owned team's sites go with it. `sites.team_id`
  // is ON DELETE RESTRICT, so missing one of these blocks the team delete
  // rather than silently orphaning it. `sites.owner_id` is creator attribution
  // and grants nothing: a Site the user created inside someone else's team
  // stays with that team, and only the attribution is cleared below. Same
  // scope as nuxtseo.com.
  const ownedSiteRows = ownedTeamIds.length
    ? await db.select({ id: sites.id }).from(sites).where(inArray(sites.teamId, ownedTeamIds))
    : []
  const siteIds = ownedSiteRows.map(s => s.id)

  const hasSites = () => siteIds.length > 0
  const hasTeams = () => ownedTeamIds.length > 0
  const siteList = () => idList(siteIds)
  const teamList = () => idList(ownedTeamIds)

  // Delete plan: ordered list of (label, predicate, runner).
  // Children before parents; the users <-> teams cycle is broken before
  // the users row goes, then the team follows.
  const plan: Array<{ table: string, count: () => Promise<number>, run?: () => Promise<unknown> }> = [
    // ── Per-user rows with no other parents ──────────────────────────────
    {
      table: 'sessions',
      count: () => scalar(db, sql`select count(*) as c from sessions where user_id = ${userId}`),
      run: () => db.delete(sessions).where(eq(sessions.userId, userId)),
    },
    {
      table: 'user_sites',
      count: () => scalar(db, sql`select count(*) as c from user_sites where user_id = ${userId}`),
      run: () => db.delete(userSites).where(eq(userSites.userId, userId)),
    },
    {
      table: 'team_user',
      count: () => scalar(db, sql`select count(*) as c from team_user where user_id = ${userId}`),
      run: () => db.delete(teamUser).where(eq(teamUser.userId, userId)),
    },
    {
      table: 'pro_events',
      count: () => scalar(db, sql`select count(*) as c from pro_events where user_id = ${userId}`),
      run: () => db.delete(proEvents).where(eq(proEvents.userId, userId)),
    },
    {
      table: 'notifications',
      count: () => scalar(db, sql`select count(*) as c from notifications where user_id = ${userId}`),
      run: () => db.delete(notifications).where(eq(notifications.userId, userId)),
    },
    {
      table: 'feedback',
      count: () => scalar(db, sql`select count(*) as c from feedback where user_id = ${userId}`),
      // feedback is set-null on cascade; preserve the row, blank the user pointer.
      run: () => db.update(feedback).set({ userId: null }).where(eq(feedback.userId, userId)),
    },
    {
      table: 'telemetry_events',
      count: () => scalar(db, sql`select count(*) as c from telemetry_events where user_id = ${userId}`),
      run: () => db.update(telemetryEvents).set({ userId: null }).where(eq(telemetryEvents.userId, userId)),
    },
    {
      table: 'admin_events_actor_nullified',
      count: () => scalar(db, sql`select count(*) as c from admin_events where actor_user_id = ${userId}`),
      // Audit trail is preserved; only the actor pointer is blanked.
      run: () => db.update(adminEvents).set({ actorUserId: null }).where(eq(adminEvents.actorUserId, userId)),
    },
    // ── Queue rows carry user/site payloads without FKs; purge by pointer ─
    {
      table: 'jobs',
      count: () => hasSites()
        ? scalar(db, sql`select count(*) as c from jobs where user_id = ${userId} or site_id in ${siteList()}`)
        : scalar(db, sql`select count(*) as c from jobs where user_id = ${userId}`),
      run: () => hasSites()
        ? db.delete(jobs).where(or(eq(jobs.userId, userId), inArray(jobs.siteId, siteIds)))
        : db.delete(jobs).where(eq(jobs.userId, userId)),
    },
    {
      table: 'failed_jobs',
      count: () => hasSites()
        ? scalar(db, sql`select count(*) as c from failed_jobs where user_id = ${userId} or site_id in ${siteList()}`)
        : scalar(db, sql`select count(*) as c from failed_jobs where user_id = ${userId}`),
      run: () => hasSites()
        ? db.delete(failedJobs).where(or(eq(failedJobs.userId, userId), inArray(failedJobs.siteId, siteIds)))
        : db.delete(failedJobs).where(eq(failedJobs.userId, userId)),
    },
    {
      table: 'job_batches',
      count: () => hasSites()
        ? scalar(db, sql`select count(*) as c from job_batches where user_id = ${userId} or site_id in ${siteList()}`)
        : scalar(db, sql`select count(*) as c from job_batches where user_id = ${userId}`),
      run: () => hasSites()
        ? db.delete(jobBatches).where(or(eq(jobBatches.userId, userId), inArray(jobBatches.siteId, siteIds)))
        : db.delete(jobBatches).where(eq(jobBatches.userId, userId)),
    },
    // ── Owned-site children ──────────────────────────────────────────────
    {
      table: 'usages',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from usages where site_id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(usages).where(inArray(usages.siteId, siteIds)) : Promise.resolve(),
    },
    {
      table: 'indexing_jobs',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from indexing_jobs where site_id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(indexingJobs).where(inArray(indexingJobs.siteId, siteIds)) : Promise.resolve(),
    },
    {
      table: 'indexing_investigations',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from indexing_investigations where site_id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(indexingInvestigations).where(inArray(indexingInvestigations.siteId, siteIds)) : Promise.resolve(),
    },
    {
      // Other members' visibility rows pointing at the owned sites.
      table: 'user_sites_by_site',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from user_sites where site_id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(userSites).where(inArray(userSites.siteId, siteIds)) : Promise.resolve(),
    },
    {
      table: 'team_sites',
      count: () => hasSites()
        ? scalar(db, sql`select count(*) as c from team_sites where site_id in ${siteList()}${hasTeams() ? sql` or team_id in ${teamList()}` : sql``}`)
        : (hasTeams() ? scalar(db, sql`select count(*) as c from team_sites where team_id in ${teamList()}`) : Promise.resolve(0)),
      run: () => hasSites() && hasTeams()
        ? db.delete(teamSites).where(or(inArray(teamSites.siteId, siteIds), inArray(teamSites.teamId, ownedTeamIds)))
        : (hasSites()
            ? db.delete(teamSites).where(inArray(teamSites.siteId, siteIds))
            : (hasTeams() ? db.delete(teamSites).where(inArray(teamSites.teamId, ownedTeamIds)) : Promise.resolve())),
    },
    {
      // Referenced by team_sites, so it must go after that purge.
      table: 'google_accounts',
      count: () => scalar(db, sql`select count(*) as c from google_accounts where user_id = ${userId}`),
      run: () => db.delete(googleAccounts).where(eq(googleAccounts.userId, userId)),
    },
    {
      // Split-domain children first so parent sites can go in the next step.
      table: 'sites_children',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from sites where parent_id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(sites).where(inArray(sites.parentId, siteIds)) : Promise.resolve(),
    },
    {
      table: 'sites',
      count: () => hasSites() ? scalar(db, sql`select count(*) as c from sites where id in ${siteList()}`) : Promise.resolve(0),
      run: () => hasSites() ? db.delete(sites).where(inArray(sites.id, siteIds)) : Promise.resolve(),
    },
    {
      // Sites the user created on a team they do not own. `sites.owner_id`
      // references the user, so the attribution goes before the users row.
      table: 'sites_creator_detached',
      count: () => hasTeams()
        ? scalar(db, sql`select count(*) as c from sites where owner_id = ${userId} and team_id not in ${teamList()}`)
        : scalar(db, sql`select count(*) as c from sites where owner_id = ${userId}`),
      run: () => db.update(sites).set({ ownerId: null }).where(hasTeams()
        ? and(eq(sites.ownerId, userId), notInArray(sites.teamId, ownedTeamIds))
        : eq(sites.ownerId, userId)),
    },
    // ── Owned-team scoped rows ───────────────────────────────────────────
    {
      table: 'site_groups',
      count: () => hasTeams() ? scalar(db, sql`select count(*) as c from site_groups where team_id in ${teamList()}`) : Promise.resolve(0),
      run: () => hasTeams() ? db.delete(siteGroups).where(inArray(siteGroups.teamId, ownedTeamIds)) : Promise.resolve(),
    },
    {
      table: 'team_gsc_credentials',
      count: () => scalar(db, sql`select count(*) as c from team_gsc_credentials where user_id = ${userId}${hasTeams() ? sql` or team_id in ${teamList()}` : sql``}`),
      run: () => db.delete(teamGscCredentials).where(
        hasTeams()
          ? or(eq(teamGscCredentials.userId, userId), inArray(teamGscCredentials.teamId, ownedTeamIds))
          : eq(teamGscCredentials.userId, userId),
      ),
    },
    {
      table: 'team_invitations',
      count: () => scalar(db, sql`select count(*) as c from team_invitations where invited_by_id = ${userId}${hasTeams() ? sql` or team_id in ${teamList()}` : sql``}`),
      run: () => db.delete(teamInvitations).where(
        hasTeams()
          ? or(eq(teamInvitations.invitedById, userId), inArray(teamInvitations.teamId, ownedTeamIds))
          : eq(teamInvitations.invitedById, userId),
      ),
    },
    {
      table: 'team_memberships',
      count: () => scalar(db, sql`select count(*) as c from team_memberships where user_id = ${userId}${hasTeams() ? sql` or team_id in ${teamList()}` : sql``}`),
      run: () => db.delete(teamMemberships).where(
        hasTeams()
          ? or(eq(teamMemberships.userId, userId), inArray(teamMemberships.teamId, ownedTeamIds))
          : eq(teamMemberships.userId, userId),
      ),
    },
    {
      // Legacy membership rows for owned teams (no cascade in the live DDL).
      table: 'team_user_by_team',
      count: () => hasTeams() ? scalar(db, sql`select count(*) as c from team_user where team_id in ${teamList()}`) : Promise.resolve(0),
      run: () => hasTeams() ? db.delete(teamUser).where(inArray(teamUser.teamId, ownedTeamIds)) : Promise.resolve(),
    },
    {
      table: 'team_audit_events_actor_nullified',
      count: () => scalar(db, sql`select count(*) as c from team_audit_events where actor_user_id = ${userId}`),
      // Schema declares actorUserId as set-null on user delete; preserve the audit trail.
      run: () => db.update(teamAuditEvents).set({ actorUserId: null }).where(eq(teamAuditEvents.actorUserId, userId)),
    },
    {
      table: 'team_audit_events',
      count: () => hasTeams() ? scalar(db, sql`select count(*) as c from team_audit_events where team_id in ${teamList()}`) : Promise.resolve(0),
      run: () => hasTeams() ? db.delete(teamAuditEvents).where(inArray(teamAuditEvents.teamId, ownedTeamIds)) : Promise.resolve(),
    },
    // ── Break the users <-> teams cycle, then delete both sides ──────────
    {
      // Other members may point at an owned team via current_team_id; move
      // them back to their own personal team first or the team delete blocks.
      table: 'members_reassigned',
      count: () => hasTeams()
        ? scalar(db, sql`select count(*) as c from users where current_team_id in ${teamList()} and user_id != ${userId} and exists (select 1 from teams t2 where t2.owner_id = users.user_id and t2.personal_team = 1)`)
        : Promise.resolve(0),
      run: () => hasTeams()
        ? db.update(users).set({
            currentTeamId: sql`(select t2.team_id from teams t2 where t2.owner_id = users.user_id and t2.personal_team = 1 limit 1)`,
          }).where(sql`current_team_id in ${teamList()} and user_id != ${userId} and exists (select 1 from teams t2 where t2.owner_id = users.user_id and t2.personal_team = 1)`)
        : Promise.resolve(),
    },
    {
      table: 'teams_owner_detached',
      count: () => Promise.resolve(ownedTeamIds.length),
      run: () => hasTeams() ? db.update(teams).set({ ownerId: null }).where(eq(teams.ownerId, userId)) : Promise.resolve(),
    },
    {
      table: 'user_identities',
      count: () => scalar(db, sql`select count(*) as c from user_identities where user_id = ${userId}`),
      run: () => db.delete(userIdentities).where(eq(userIdentities.userId, userId)),
    },
    {
      table: 'users',
      count: () => Promise.resolve(1),
      run: () => db.delete(users).where(eq(users.userId, userId)),
    },
    {
      table: 'teams',
      count: () => Promise.resolve(ownedTeamIds.length),
      run: () => hasTeams() ? db.delete(teams).where(inArray(teams.teamId, ownedTeamIds)) : Promise.resolve(),
    },
  ]

  const deleted: Record<string, number> = {}
  for (const step of plan) {
    const before = await step.count().catch((err) => {
      warnings.push(`count ${step.table}: ${(err as Error).message}`)
      return 0
    })
    deleted[step.table] = before
    if (!dryRun && step.run && before > 0) {
      await step.run().catch((err) => {
        warnings.push(`delete ${step.table}: ${(err as Error).message}`)
      })
    }
  }

  // Verify the users row is actually gone — otherwise re-login via OAuth will
  // restore the account by github_id match and the "delete" was a lie.
  let ok = true
  if (!dryRun) {
    const remaining = await scalar(db, sql`select count(*) as c from users where user_id = ${userId}`).catch(() => -1)
    if (remaining !== 0) {
      ok = false
      warnings.push(`users row still present after delete (count=${remaining})`)
    }
  }

  // Post-hook: best-effort listeners (audit log, async cleanup). Errors are
  // swallowed inside listener plugins; never propagate to the caller.
  if (!dryRun && ok) {
    await dispatchEvent('pro:user:deleted', {
      event,
      userId,
      email: primaryEmail,
      gscdumpUserId: user.gscdumpUserId ?? null,
    }).catch((err: unknown) => {
      getProLogger(event).error('pro:user:deleted hook failed', err)
    })
  }

  return {
    userId,
    dryRun,
    user: {
      id: user.userId,
      name: primaryIdentity?.displayName ?? null,
      email: primaryIdentity?.email ?? null,
      identities: sortedIdentities.map(i => ({
        provider: i.provider,
        email: i.email,
        displayName: i.displayName,
      })),
      gscdumpUserId: user.gscdumpUserId,
    },
    deleted,
    ok,
    warnings,
  }
}

function idList(ids: (number | string)[]) {
  // Drizzle's inArray works for delete/update; for raw scalar count we hand-build the SQL list.
  return sql`(${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
}

async function scalar(db: ReturnType<typeof useDrizzle>, query: ReturnType<typeof sql>): Promise<number> {
  const rows = await db.all<{ c: number }>(query)
  return Number(rows[0]?.c ?? 0)
}
