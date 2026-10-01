// getCaller: the server seam for user context. See CONTEXT.md.
// Memoized per-request via event.context.__caller. Validates against the DB
// every request (per ADR-0001: session is a cache, not truth) and caches the
// resolved Caller for the lifetime of the request only.

import type { H3Event } from 'h3'
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import type { Caller } from '../../shared/caller'
import type { Team, TeamRole, User } from '../database'
import { desc, eq } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { ProError } from '../../shared/errors'
import { teamMemberships, teams, userIdentities, users } from '../database'
import { rememberCallerRows } from './caller-rows'

const CACHE_KEY = '__caller' as const

interface PrimaryIdentity {
  provider: AuthProviderId
  displayName: string | null
  email: string | null
  avatarUrl: string | null
}

type Db = ReturnType<typeof useDrizzle>

interface IdentityRow {
  provider: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
}

interface MemberOfRow {
  team: Team
  role: TeamRole
  firstVisitDismissedAt: Date | null
}

/** Every row caller resolution needs about one user. */
interface LoadedCallerRows {
  user: User
  identities: IdentityRow[]
  owned: Team[]
  memberOf: MemberOfRow[]
}

type CallerRowsRead
  = | { _tag: 'Found', rows: LoadedCallerRows }
    | { _tag: 'NotFound' }
    | { _tag: 'Unavailable', cause: unknown }

/**
 * The four statements caller resolution needs, all keyed off `userId` alone.
 *
 * Ported from nuxtseo.com's `callerRowQueries`. They used to run as two serial
 * waves (the user, then identities and teams). D1 runs in WEUR, so each wave
 * cost 110 to 300 ms, and every signed-in page resolves the caller up to
 * three times (`/api/pro/caller`, the roster, a Site read). One batch is one
 * round trip. Team rows come back whole, so `requireCurrentTeam` can reuse
 * them instead of reading the team again.
 *
 * No statement may select two columns with the same name: a D1 batch returns
 * rows keyed by column name, so a duplicate would collapse.
 */
function callerRowQueries(db: Db, userId: number) {
  return [
    db.select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1),
    db.select({
      provider: userIdentities.provider,
      displayName: userIdentities.displayName,
      email: userIdentities.email,
      avatarUrl: userIdentities.avatarUrl,
    })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId))
      .orderBy(desc(userIdentities.lastUsedAt)),
    db.select()
      .from(teams)
      .where(eq(teams.ownerId, userId)),
    db.select({
      team: teams,
      role: teamMemberships.role,
      firstVisitDismissedAt: teamMemberships.firstVisitDismissedAt,
    })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.teamId, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId)),
  ] as const
}

/**
 * Read the caller's rows in one round trip, keeping the old failure rules.
 *
 * `user_identities` has always been allowed to fail without failing the
 * request: the caller still authenticates and loses only its display fields.
 * A D1 batch is one transaction, so keeping that tolerance means retrying the
 * other three statements. A failure there is the database not answering,
 * which is `Unavailable`, never evidence that the account is gone (D4).
 */
async function readCallerRows(db: Db, userId: number): Promise<CallerRowsRead> {
  const queries = callerRowQueries(db, userId)
  return db.batch(queries)
    .then(([user, identities, owned, memberOf]) => ({ user: user[0], identities, owned, memberOf }))
    .catch(async (identitiesCandidate: unknown) => {
      logger.error('[get-caller] caller batch failed, retrying without identities:', identitiesCandidate)
      const [user, owned, memberOf] = await db.batch([queries[0], queries[2], queries[3]])
      return { user: user[0], identities: [] as IdentityRow[], owned, memberOf }
    })
    .then(
      ({ user, identities, owned, memberOf }): CallerRowsRead => user
        ? { _tag: 'Found', rows: { user, identities, owned, memberOf: memberOf as MemberOfRow[] } }
        : { _tag: 'NotFound' },
      (cause: unknown): CallerRowsRead => ({ _tag: 'Unavailable', cause }),
    )
}

function buildMemberships(owned: Team[], memberOf: MemberOfRow[]): Caller['memberships'] {
  return [
    ...owned.map(t => ({
      teamId: t.teamId,
      teamName: t.name,
      role: 'owner' as const,
      isOwner: true,
      isPersonal: !!t.personalTeam,
      // Owners have no `team_memberships` row; treat as already-oriented so
      // the orientation card never shows for owners (ONBOARDING.md §9).
      firstVisitDismissedAt: null,
    })),
    ...memberOf.map(m => ({
      teamId: m.team.teamId,
      teamName: m.team.name,
      role: m.role,
      isOwner: false,
      isPersonal: !!m.team.personalTeam,
      firstVisitDismissedAt: m.firstVisitDismissedAt
        ? (m.firstVisitDismissedAt instanceof Date
            ? m.firstVisitDismissedAt.toISOString()
            : new Date(m.firstVisitDismissedAt as unknown as number).toISOString())
        : null,
    })),
  ]
}

// The user's most-recent identity row (`user_identities`, ordered by
// `last_used_at DESC`). Identity-driven caller fields (`name`, `avatarUrl`,
// `email`, `providers`) derive from this row.
function buildPrimaryIdentity(rows: IdentityRow[]): { primary: PrimaryIdentity | null, providers: AuthProviderId[] } {
  const primary = rows[0]
    ? {
        provider: rows[0].provider as AuthProviderId,
        displayName: rows[0].displayName,
        email: rows[0].email,
        avatarUrl: rows[0].avatarUrl,
      }
    : null
  return {
    primary,
    providers: rows.map(r => r.provider as AuthProviderId),
  }
}

function teamsById(rows: LoadedCallerRows): ReadonlyMap<number, Team> {
  return new Map([...rows.owned, ...rows.memberOf.map(m => m.team)].map(team => [team.teamId, team]))
}

function buildCaller(
  event: H3Event,
  db: ReturnType<typeof useDrizzle>,
  user: User,
  identity: PrimaryIdentity | null,
  providers: AuthProviderId[],
  memberships: Caller['memberships'],
  isAdmin: boolean,
): Caller {
  const name = identity?.displayName ?? null
  const email = identity?.email ?? user.email ?? null
  const avatarUrl = identity?.avatarUrl ?? null
  return {
    user: {
      id: user.userId,
      email,
      name,
      avatarUrl,
      providers,
      createdAt: user.createdAt ? new Date(user.createdAt as unknown as number).toISOString() : null,
    },
    memberships,
    // `users.current_team_id` is a remembered selection, and it can outlive a
    // membership. A team the user has left never reaches a route as current.
    currentTeamId: memberships.some(m => m.teamId === user.currentTeamId) ? user.currentTeamId : null,
    isAdmin,
  }
}

export async function getCaller(event: H3Event): Promise<Caller | null> {
  const ctx = event.context as Record<string, unknown>
  const cached = ctx[CACHE_KEY]
  if (cached !== undefined)
    return cached as Caller | null

  const db = useDrizzle(event)

  // Session path.
  const session = await getUserSession(event)
  if (!session.user?.id) {
    ctx[CACHE_KEY] = null
    return null
  }
  const read = await readCallerRows(db, session.user.id)

  // A read the database never answered says nothing about the account. Fail
  // this request and keep the sealed session; nothing is memoized, so the next
  // request re-reads (D4).
  if (read._tag === 'Unavailable') {
    logger.error('[get-caller] user lookup unavailable:', read.cause)
    throw createError({ statusCode: 503, message: 'Service unavailable' })
  }

  if (read._tag === 'NotFound') {
    // User row gone; clear the stale cookie so the client knows.
    await clearUserSession(event)
    ctx[CACHE_KEY] = null
    return null
  }

  const { user } = read.rows
  const { primary, providers } = buildPrimaryIdentity(read.rows.identities)
  const memberships = buildMemberships(read.rows.owned, read.rows.memberOf)
  rememberCallerRows(event, { user, teams: teamsById(read.rows) })
  const caller = buildCaller(event, db, user, primary, providers, memberships, isAdminEmail(session.user.email ?? null))
  ctx[CACHE_KEY] = caller
  return caller
}

export async function requireCaller(event: H3Event): Promise<Caller> {
  const caller = await getCaller(event)
  if (!caller)
    throw new ProError('unauthorized')
  return caller
}
