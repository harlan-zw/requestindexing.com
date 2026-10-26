import type { AuthProviderId, NewUser } from '../database'
import { eq, sql } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { teams, userIdentities, users } from '../database'
import { emitFirstProEvent } from './pro-events'

/**
 * `currentTeamId` is deliberately excluded: this helper creates the personal
 * team and owns that value. The column is NOT NULL, so accepting it from
 * callers is how the previous version ended up inserting users before their
 * team existed.
 */
export type CreateUserInput = Omit<NewUser, 'currentTeamId'>

export interface CreateUserIdentityInput {
  provider: AuthProviderId
  providerUserId: string
  email?: string | null
  emailVerified?: boolean
  displayName?: string | null
  avatarUrl?: string | null
}

/**
 * Atomically create a new user + their personal team + set users.currentTeamId.
 * Every signup site MUST use this helper so no user ever exists without a
 * personal team.
 *
 * D1 batches execute sequentially in one transaction. A failed link rolls back
 * both inserts.
 *
 * The `identity` arg is optional: signup paths that already know a provider
 * identity can write the `user_identities` row inline so the user can
 * immediately sign in.
 */
export async function createUserWithPersonalTeam(
  db: ReturnType<typeof useDrizzle>,
  userInsert: CreateUserInput,
  identity?: CreateUserIdentityInput,
) {
  // Team first satisfies the required User link. Each statement can use the
  // preceding insert's numeric ID inside the same D1 transaction.
  const teamName = personalTeamName(userInsert, identity)
  const [, [userRow], [teamRow]] = await db.batch([
    db.insert(teams).values({ name: teamName, personalTeam: true }),
    db.insert(users).values({ ...userInsert, currentTeamId: sql<number>`last_insert_rowid()` }).returning(),
    db.update(teams)
      .set({ ownerId: sql<number>`last_insert_rowid()`, updatedAt: Date.now() })
      .where(eq(teams.teamId, sql<number>`(SELECT ${users.currentTeamId} FROM ${users} WHERE ${users.userId} = last_insert_rowid())`))
      .returning(),
  ])

  if (!userRow || !teamRow)
    throw new Error('createUserWithPersonalTeam: account batch returned no row')

  if (identity) {
    const now = new Date()
    await db.insert(userIdentities).values({
      userId: userRow.userId,
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email ?? null,
      emailVerified: identity.emailVerified ?? false,
      displayName: identity.displayName ?? null,
      avatarUrl: identity.avatarUrl ?? null,
      linkedAt: now,
      lastUsedAt: now,
    }).catch(err => logWarn('create_user.identity_insert_failed', err, { userId: userRow.userId, provider: identity.provider }))
  }

  // Record the first funnel milestone. The user row, the personal team and the
  // identity row all exist here, so this is the first moment an account is real.
  // `emitFirstProEvent` never throws, so signup keeps its own failure modes.
  await emitFirstProEvent(db, userRow.userId, 'signed_up', {
    source: userInsert.source ?? null,
    provider: identity?.provider ?? null,
  })

  return {
    user: { ...userRow, currentTeamId: teamRow.teamId },
    team: teamRow,
  }
}

function personalTeamName(u: CreateUserInput, identity?: CreateUserIdentityInput): string {
  return identity?.displayName || u.email?.split('@')[0] || 'My team'
}
