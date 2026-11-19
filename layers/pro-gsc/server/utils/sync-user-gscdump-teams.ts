// Sync a freshly-connected gscdump identity into existing pro teams.
//
// Two passes:
//  1. Owned teams without a `gscdumpTeamId` → create the gscdump-side team and
//     persist the id (covers users who created pro teams before connecting gscdump).
//  2. Member-of teams that already have a `gscdumpTeamId` → addMember so gscdump's
//     `requireSiteAccess` authorizes the user on the team-share R2 path.
//
// Account recovery also resolves the Personal Team of the replacement identity.

import type { H3Event } from 'h3'
import { and, eq, exists, isNull, or } from 'drizzle-orm'
import { teamMemberships, teams, users } from '#layers/pro-saas/server/database'
import { useGscdumpTeamsClient } from './gscdump-teams-client'

export async function syncUserGscdumpTeams(event: H3Event | undefined, opts: {
  userId: number
  gscdumpUserId: string
  mode: 'regular' | 'account-recovery' | 'personal-team-repair'
}) {
  const { userId, gscdumpUserId, mode } = opts
  const db = useDrizzle(event)
  const teamsClient = useGscdumpTeamsClient(event)

  const ownTeams = await db.select({
    id: teams.teamId,
    name: teams.name,
    personalTeam: teams.personalTeam,
    gscdumpTeamId: teams.gscdumpTeamId,
  })
    .from(teams)
    .where(and(
      eq(teams.ownerId, userId),
      mode === 'personal-team-repair'
        ? eq(teams.personalTeam, true)
        : or(isNull(teams.gscdumpTeamId), mode === 'account-recovery' ? eq(teams.personalTeam, true) : undefined),
    ))
    .all()

  for (const team of ownTeams) {
    const recoveringPersonalTeam = mode !== 'regular' && team.personalTeam
    // gscdump returns the canonical Personal Team for this owner.
    const result = await teamsClient.createTeam(
      { ownerUserId: gscdumpUserId, name: team.name, personalTeam: team.personalTeam },
      { actorUserId: userId, proTeamId: team.id },
    )
    if (!result?.team?.id) {
      if (recoveringPersonalTeam)
        throw new Error('Could not recover the gscdump Personal Team.')
      continue
    }

    const currentIdentity = db.select({ id: users.userId }).from(users).where(and(
      eq(users.userId, userId),
      eq(users.gscdumpUserId, gscdumpUserId),
      mode === 'account-recovery' && recoveringPersonalTeam ? eq(users.gscdumpRecoveryLinkReconcileUserId, gscdumpUserId) : undefined,
    ))
    const updated = await db.update(teams)
      .set({ gscdumpTeamId: result.team.id, updatedAt: Date.now() })
      .where(and(
        eq(teams.teamId, team.id),
        eq(teams.ownerId, userId),
        team.gscdumpTeamId === null ? isNull(teams.gscdumpTeamId) : eq(teams.gscdumpTeamId, team.gscdumpTeamId),
        exists(currentIdentity),
      ))
      .returning({ id: teams.teamId })
      .get()
    if (!updated && recoveringPersonalTeam)
      throw new Error('The Personal Team changed during gscdump recovery.')
  }

  // The rollout verifies only owned Personal Teams. Shared Teams and memberships stay untouched.
  if (mode === 'personal-team-repair')
    return

  // Pass 2 — non-owned memberships in teams that have a gscdumpTeamId.
  const memberRows = await db.select({
    teamId: teams.teamId,
    gscdumpTeamId: teams.gscdumpTeamId,
    role: teamMemberships.role,
  })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.teamId, teamMemberships.teamId))
    .where(eq(teamMemberships.userId, userId))
    .all()

  for (const m of memberRows) {
    if (!m.gscdumpTeamId)
      continue
    await teamsClient.addMember(
      m.gscdumpTeamId,
      { userId: gscdumpUserId, role: m.role },
      { actorUserId: userId, proTeamId: m.teamId },
    )
  }
}

// Resolve a pro user's gscdump publicId from the users table.
export async function getGscdumpUserId(event: H3Event | undefined, userId: number): Promise<string | null> {
  const db = useDrizzle(event)
  const row = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, userId))
    .get()
  return row?.gscdumpUserId ?? null
}
