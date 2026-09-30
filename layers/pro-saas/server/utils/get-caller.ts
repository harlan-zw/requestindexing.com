// getCaller: the server seam for user context. See CONTEXT.md.
// Memoized per-request via event.context.__caller. Validates against the DB
// every request (per ADR-0001: session is a cache, not truth) and caches the
// resolved Caller for the lifetime of the request only.

import type { H3Event } from 'h3'
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import type { Caller } from '../../shared/caller'
import type { User } from '../database'
import { desc, eq } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { lookupUser } from '~~/shared/server/user-lookup'
import { ProError } from '../../shared/errors'
import { teamMemberships, teams, userIdentities, users } from '../database'

const CACHE_KEY = '__caller' as const

interface PrimaryIdentity {
  provider: AuthProviderId
  displayName: string | null
  email: string | null
  avatarUrl: string | null
}

async function loadMemberships(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<Caller['memberships']> {
  const [owned, memberOf] = await Promise.all([
    db.select({
      id: teams.teamId,
      name: teams.name,
      personalTeam: teams.personalTeam,
    })
      .from(teams)
      .where(eq(teams.ownerId, userId))
      .all(),
    db.select({
      id: teams.teamId,
      name: teams.name,
      personalTeam: teams.personalTeam,
      role: teamMemberships.role,
      firstVisitDismissedAt: teamMemberships.firstVisitDismissedAt,
    })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.teamId, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId))
      .all(),
  ])
  return [
    ...owned.map(t => ({
      teamId: t.id,
      teamName: t.name,
      role: 'owner' as const,
      isOwner: true,
      isPersonal: !!t.personalTeam,
      // Owners have no `team_memberships` row; treat as already-oriented so
      // the orientation card never shows for owners (ONBOARDING.md §9).
      firstVisitDismissedAt: null,
    })),
    ...memberOf.map(t => ({
      teamId: t.id,
      teamName: t.name,
      role: t.role,
      isOwner: false,
      isPersonal: !!t.personalTeam,
      firstVisitDismissedAt: t.firstVisitDismissedAt
        ? (t.firstVisitDismissedAt instanceof Date
            ? t.firstVisitDismissedAt.toISOString()
            : new Date(t.firstVisitDismissedAt as unknown as number).toISOString())
        : null,
    })),
  ]
}

// Look up the user's most-recent identity row (`user_identities`, ordered by
// `last_used_at DESC`). Identity-driven caller fields (`name`, `avatarUrl`,
// `email`, `providers`) derive from this row.
async function loadPrimaryIdentity(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<{ primary: PrimaryIdentity | null, providers: AuthProviderId[] }> {
  const rows = await db.select({
    provider: userIdentities.provider,
    displayName: userIdentities.displayName,
    email: userIdentities.email,
    avatarUrl: userIdentities.avatarUrl,
    lastUsedAt: userIdentities.lastUsedAt,
  })
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId))
    .orderBy(desc(userIdentities.lastUsedAt))
    .all()
    .catch((error: unknown) => {
      logger.error('[get-caller] identity lookup failed:', error)
      return []
    })
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
  const lookup = await lookupUser(() => db.query.users.findFirst({ where: eq(users.userId, session.user!.id) }))

  // A read the database never answered says nothing about the account. Fail
  // this request and keep the sealed session; nothing is memoized, so the next
  // request re-reads (D4).
  if (lookup._tag === 'Unavailable') {
    logger.error('[get-caller] user lookup unavailable:', lookup.cause)
    throw createError({ statusCode: 503, message: 'Service unavailable' })
  }

  if (lookup._tag === 'NotFound') {
    // User row gone; clear the stale cookie so the client knows.
    await clearUserSession(event)
    ctx[CACHE_KEY] = null
    return null
  }

  const user = lookup.user
  const [{ primary, providers }, memberships] = await Promise.all([
    loadPrimaryIdentity(db, user.userId),
    loadMemberships(db, user.userId),
  ])
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
