// Personal-team backfill. Steady-state, every user gets a personal team via
// createUserWithPersonalTeam at signup. This helper exists for legacy users
// predating that helper and for explicit backfill scripts. It must not be
// called from read-shaped request handlers; if a request needs it, that is a
// signal we still have orphan users in production.

import type { Team } from '../database'
import { and, eq, sql } from 'drizzle-orm'
import { teams, userIdentities, users } from '../database'

export async function ensurePersonalTeam(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<Team | null> {
  const account = await db.select({
    currentTeamId: users.currentTeamId,
    team: teams,
    displayName: sql<string | null>`(SELECT ${userIdentities.displayName} FROM ${userIdentities} WHERE ${userIdentities.userId} = ${users.userId} ORDER BY ${userIdentities.lastUsedAt} DESC LIMIT 1)`,
  }).from(users).leftJoin(teams, and(eq(teams.ownerId, users.userId), eq(teams.personalTeam, true))).where(eq(users.userId, userId)).get()
  if (!account)
    return null

  if (account.team) {
    if (account.currentTeamId !== account.team.teamId)
      await db.update(users).set({ currentTeamId: account.team.teamId }).where(eq(users.userId, userId))
    return account.team
  }

  const [[inserted]] = await db.batch([
    db.insert(teams).values({
      ownerId: userId,
      name: account.displayName || 'My team',
      personalTeam: true,
    }).returning(),
    db.update(users).set({ currentTeamId: sql<number>`last_insert_rowid()` }).where(eq(users.userId, userId)),
  ])
  if (!inserted)
    throw new Error('ensurePersonalTeam: team batch returned no row')
  return inserted
}
