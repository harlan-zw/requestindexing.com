// Rows the caller batch already read, kept for the rest of the request.
//
// `getCaller` reads the user and every team the user belongs to in one D1
// round trip. Before this module, the next helpers in the same request read
// the same rows again: `requireCurrentTeam` re-read the team, and the roster
// re-read `users.gscdump_user_id`. D1 runs in WEUR, so each repeat cost 110 to
// 300 ms on every signed-in page (trace c7879cbb, 2026-10-01).
//
// The rows live on `event.context`, so they are request-scoped and never
// outlive the request that read them. A helper that finds nothing here reads
// the database itself, so the rows are an optimisation, never a dependency.
import type { H3Event } from 'h3'
import type { Team, User } from '../database'
import { eq } from 'drizzle-orm'
import { users } from '../database'

const CONTEXT_KEY = '__callerRows' as const

export interface CallerRows {
  user: User
  /** Every team the caller owns or is a member of, keyed by team id. */
  teams: ReadonlyMap<number, Team>
}

type Db = ReturnType<typeof useDrizzle>

export function rememberCallerRows(event: H3Event, rows: CallerRows): void {
  (event.context as Record<string, unknown>)[CONTEXT_KEY] = rows
}

export function loadedCallerRows(event: H3Event): CallerRows | undefined {
  return (event.context as Record<string, unknown>)[CONTEXT_KEY] as CallerRows | undefined
}

/** A team row the caller batch read in this request, if it read one. */
export function loadedCallerTeam(event: H3Event, teamId: number): Team | undefined {
  return loadedCallerRows(event)?.teams.get(teamId)
}

/**
 * The caller's gscdump user id. The caller batch already holds the user row,
 * so this reads D1 only when nothing resolved the caller in this request.
 */
export async function readCallerGscdumpUserId(event: H3Event, db: Db, userId: number): Promise<string | null> {
  const rows = loadedCallerRows(event)
  if (rows && rows.user.userId === userId)
    return rows.user.gscdumpUserId
  const [user] = await db.select({ gscdumpUserId: users.gscdumpUserId })
    .from(users)
    .where(eq(users.userId, userId))
  return user?.gscdumpUserId ?? null
}

/**
 * The caller's gscdump connection columns. The caller batch already holds the
 * user row, so this reads D1 only when nothing resolved the caller in this
 * request.
 */
export async function readCallerGscdumpConnection(event: H3Event, db: Db, userId: number): Promise<Pick<User, 'gscdumpUserId' | 'gscdumpApiKey'> | null> {
  const rows = loadedCallerRows(event)
  if (rows && rows.user.userId === userId)
    return { gscdumpUserId: rows.user.gscdumpUserId, gscdumpApiKey: rows.user.gscdumpApiKey }
  const [user] = await db.select({ gscdumpUserId: users.gscdumpUserId, gscdumpApiKey: users.gscdumpApiKey })
    .from(users)
    .where(eq(users.userId, userId))
  return user ?? null
}
