// Session enrichment: the rows the session fetch hook needs, in one D1 round
// trip.
//
// nuxt-auth-utils awaits the fetch hook before a signed-in page renders
// anything. The hook used to read the user, the current team, the primary
// identity, the Google account and the has-Sites flag one after another. D1
// runs in WEUR, so each read cost 110 to 300 ms and the hook alone took 0.6 to
// 1.9 s (`/api/_auth/session`, Workers Logs, 2026-10-01). Ported from
// nuxtseo.com's `sessionEnrichmentQueries`: the team-scoped read reaches the
// current team through a sub-select instead of waiting for the user row, so
// all five statements ride one batch. A batch is one transaction, so every
// statement agrees on which team is current.
import type { User } from '../database'
import type { CurrentTeam } from './current-team'
import type { GscAccountRow } from './gsc-session-fields'
import { desc, eq, inArray } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { lookupUser } from '~~/shared/server/user-lookup'
import { googleAccounts, sites, userIdentities, users } from '../database'
import { currentTeamIdQuery, currentTeamQuery } from './current-team'

type Db = ReturnType<typeof useDrizzle>

/** The identity columns the session reads from the most recently used identity. */
export interface SessionIdentityRow {
  provider: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface SessionEnrichmentRows {
  user: User
  /** Null when the user has no current team, or left the one they last selected. */
  currentTeam: CurrentTeam | null
  primaryIdentity: SessionIdentityRow | null
  googleAccount: GscAccountRow | null
  hasSites: boolean
}

/**
 * `Unavailable` means the database did not answer the user read. It is never
 * evidence that the account is gone, so the caller keeps the sealed session.
 */
export type SessionEnrichmentRead
  = | { _tag: 'Found', rows: SessionEnrichmentRows }
    | { _tag: 'NotFound' }
    | { _tag: 'Unavailable', cause: unknown }

/**
 * The five statements, all keyed off `userId` alone.
 *
 * No statement may select two columns with the same name: a D1 batch returns
 * rows keyed by column name, so a duplicate would collapse.
 */
export function sessionEnrichmentQueries(db: Db, userId: number) {
  return [
    db.select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1),
    currentTeamQuery(db, userId)
      .limit(1),
    db.select({
      provider: userIdentities.provider,
      email: userIdentities.email,
      displayName: userIdentities.displayName,
      avatarUrl: userIdentities.avatarUrl,
    })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId))
      .orderBy(desc(userIdentities.lastUsedAt))
      .limit(1),
    db.select({ payload: googleAccounts.payload, tokens: googleAccounts.tokens })
      .from(googleAccounts)
      .where(eq(googleAccounts.userId, userId))
      .limit(1),
    // `sites.team_id` is the ownership axis, so the roster is one read.
    db.select({ siteId: sites.id })
      .from(sites)
      .where(inArray(sites.teamId, currentTeamIdQuery(db, userId)))
      .limit(1),
  ] as const
}

/**
 * Read every enrichment row in one round trip.
 *
 * The serial reads this replaces degraded one at a time: a failed team,
 * identity, Google account or has-Sites read each fell back on its own. A
 * batch fails whole, so a failed batch runs the same five statements apart,
 * concurrently, with those fallbacks. That costs one more round trip, and only
 * on the failure path. Only a user read that fails as well is `Unavailable`.
 */
export async function readSessionEnrichment(db: Db, userId: number): Promise<SessionEnrichmentRead> {
  const queries = sessionEnrichmentQueries(db, userId)
  return db.batch(queries).then(
    ([user, team, identity, account, site]): SessionEnrichmentRead => user[0]
      ? {
          _tag: 'Found',
          rows: {
            user: user[0],
            currentTeam: team[0] ?? null,
            primaryIdentity: identity[0] ?? null,
            googleAccount: account[0] ?? null,
            hasSites: site.length > 0,
          },
        }
      : { _tag: 'NotFound' },
    (batchError: unknown) => {
      logger.error('[session] enrichment batch failed, reading each row apart:', batchError)
      return readSessionEnrichmentApart(queries)
    },
  )
}

async function readSessionEnrichmentApart(queries: ReturnType<typeof sessionEnrichmentQueries>): Promise<SessionEnrichmentRead> {
  const [userQuery, teamQuery, identityQuery, accountQuery, siteQuery] = queries
  const [lookup, currentTeam, primaryIdentity, googleAccount, hasSites] = await Promise.all([
    lookupUser(() => userQuery.then(rows => rows[0])),
    teamQuery.then(rows => rows[0] ?? null).catch((error: unknown) => {
      logger.error('[session] team lookup failed:', error)
      return null
    }),
    identityQuery.then(rows => rows[0] ?? null).catch((error: unknown) => {
      logger.error('[session] identity lookup failed:', error)
      return null
    }),
    accountQuery.then(rows => rows[0] ?? null).catch((error: unknown) => {
      logger.error('[session] google account lookup failed:', error)
      return null
    }),
    siteQuery.then(rows => rows.length > 0).catch((error: unknown) => {
      logger.error('[session] hasSites lookup failed:', error)
      return false
    }),
  ])
  if (lookup._tag !== 'Found')
    return lookup
  return { _tag: 'Found', rows: { user: lookup.user, currentTeam, primaryIdentity, googleAccount, hasSites } }
}
