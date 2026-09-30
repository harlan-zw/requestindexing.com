// The user's current team, read from the database and checked against
// membership.
//
// `users.current_team_id` is a remembered selection, and the session cookie
// holds a copy of it. Both can outlive the membership that made them valid:
// removal resets the column, but a cookie sealed earlier keeps the old id, and
// rows written before the reset existed were never corrected. Every reader
// that acts on the current team, or publishes it, goes through here, so a team
// the user left never reaches it. Same rule `getCaller` applies.
import { and, eq, exists, or } from 'drizzle-orm'
import { teamMemberships, teams, users } from '../database'

type Db = ReturnType<typeof useDrizzle>

export interface CurrentTeam {
  teamId: number
  name: string
  personalTeam: boolean
}

export async function readCurrentTeam(db: Db, userId: number): Promise<CurrentTeam | null> {
  const membership = db.select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, teams.teamId), eq(teamMemberships.userId, userId)))
  const row = await db.select({ teamId: teams.teamId, name: teams.name, personalTeam: teams.personalTeam })
    .from(users)
    .innerJoin(teams, eq(teams.teamId, users.currentTeamId))
    .where(and(eq(users.userId, userId), or(eq(teams.ownerId, userId), exists(membership))))
    .get()
  return row ?? null
}
