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

// The membership rule both reads below share: the selected team counts only
// while the user owns it or still belongs to it.
function selectedTeamFilter(db: Db, userId: number) {
  const membership = db.select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .where(and(eq(teamMemberships.teamId, teams.teamId), eq(teamMemberships.userId, userId)))
  return and(eq(users.userId, userId), or(eq(teams.ownerId, userId), exists(membership)))
}

/** The current team as a query, so the session batch can run it in its one round trip. */
export function currentTeamQuery(db: Db, userId: number) {
  return db.select({ teamId: teams.teamId, name: teams.name, personalTeam: teams.personalTeam })
    .from(users)
    .innerJoin(teams, eq(teams.teamId, users.currentTeamId))
    .where(selectedTeamFilter(db, userId))
}

/** The current team's id alone, for use as a sub-select. Empty when the user has left it. */
export function currentTeamIdQuery(db: Db, userId: number) {
  return db.select({ teamId: teams.teamId })
    .from(users)
    .innerJoin(teams, eq(teams.teamId, users.currentTeamId))
    .where(selectedTeamFilter(db, userId))
}

export async function readCurrentTeam(db: Db, userId: number): Promise<CurrentTeam | null> {
  return (await currentTeamQuery(db, userId).get()) ?? null
}
