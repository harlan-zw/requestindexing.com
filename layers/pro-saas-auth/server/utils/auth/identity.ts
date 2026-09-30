import type { AuthIdentityRow, AuthProviderId, NormalizedIdentity } from '../../../shared/types/auth'
import { and, eq, inArray, ne } from 'drizzle-orm'
import * as schema from '#layers/pro-saas/server/database'

const { users, userIdentities } = schema

/**
 * The lowercased emails a person has proven they own. An OAuth provider's
 * unverified profile email proves nothing, so it never authorizes access.
 */
export function verifiedIdentityEmails(
  identities: ReadonlyArray<Pick<AuthIdentityRow, 'email' | 'emailVerified'>>,
): string[] {
  return Array.from(new Set(
    identities
      .filter(identity => identity.emailVerified && identity.email)
      .map(identity => identity.email!.toLowerCase()),
  ))
}

function rowToIdentity(row: typeof userIdentities.$inferSelect): AuthIdentityRow {
  return {
    userId: row.userId,
    provider: row.provider as AuthProviderId,
    providerUserId: row.providerUserId,
    email: row.email ?? null,
    emailVerified: !!row.emailVerified,
    displayName: row.displayName ?? null,
    avatarUrl: row.avatarUrl ?? null,
    linkedAt: row.linkedAt ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
  }
}

export async function resolveExistingUser(
  db: ReturnType<typeof useDrizzle>,
  provider: AuthProviderId,
  providerUserId: string,
) {
  // By identity row (the canonical answer).
  const identityRow = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, provider), eq(userIdentities.providerUserId, providerUserId)),
  }).catch(() => null)
  if (identityRow) {
    const user = await db.query.users.findFirst({ where: eq(users.userId, identityRow.userId) }).catch(() => null)
    if (user)
      return { user, matchedBy: 'identity' as const }
  }

  // Legacy fallback. Every account created before `user_identities` existed
  // stored Google's `sub` directly on `users.sub`, and none of them has an
  // identity row (the table is empty in production while `users` holds 2570
  // rows). Without this, each of those users looks brand new on sign-in, and
  // account creation then dies on the `users_email_unique` / `users_sub_unique`
  // constraints, surfacing as "Failed to create account".
  //
  // Google only: `users.sub` predates multi-provider auth, so a GitHub id could
  // never have been written there, and matching it cross-provider would let a
  // GitHub account with a colliding id claim someone else's row. The caller
  // upserts the identity row afterwards, so each legacy user takes this path
  // once and is matched canonically from then on.
  if (provider === 'google') {
    const legacyUser = await db.query.users.findFirst({ where: eq(users.sub, providerUserId) }).catch(() => null)
    if (legacyUser)
      return { user: legacyUser, matchedBy: 'legacy-sub' as const }
  }

  return { user: null, matchedBy: null }
}

export async function findCrossProviderConflict(
  db: ReturnType<typeof useDrizzle>,
  provider: AuthProviderId,
  userId: number,
) {
  // If a user exists but has only the OTHER provider's identity, refuse silent
  // linking and instruct them to use the original method.
  const otherIdentities = await db.query.userIdentities.findMany({
    where: and(eq(userIdentities.userId, userId), ne(userIdentities.provider, provider)),
  }).catch(() => [])
  return otherIdentities.map(r => r.provider as AuthProviderId)
}

export async function getIdentityForUser(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
  provider: AuthProviderId,
) {
  const row = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, userId), eq(userIdentities.provider, provider)),
  }).catch(() => null)
  return row ? rowToIdentity(row) : null
}

export async function getUserIdentities(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<AuthIdentityRow[]> {
  const rows = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, userId),
  }).catch(() => [])
  return rows.map(rowToIdentity)
}

export async function findIdentityByProviderEmail(
  db: ReturnType<typeof useDrizzle>,
  provider: AuthProviderId,
  email: string,
): Promise<{ userId: number, identity: AuthIdentityRow } | null> {
  const row = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, provider), eq(userIdentities.email, email)),
  }).catch(() => null)
  if (!row)
    return null
  return { userId: row.userId, identity: rowToIdentity(row) }
}

export async function getPrimaryIdentity(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
): Promise<AuthIdentityRow | null> {
  const rows = await getUserIdentities(db, userId)
  if (!rows.length)
    return null
  return rows.sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0))[0] ?? null
}

export async function getPrimaryIdentitiesForUsers(
  db: ReturnType<typeof useDrizzle>,
  userIds: number[],
): Promise<Map<number, AuthIdentityRow>> {
  const map = new Map<number, AuthIdentityRow>()
  if (!userIds.length)
    return map
  const rows = await db.query.userIdentities.findMany({
    where: inArray(userIdentities.userId, userIds),
  }).catch(() => [])
  const lastMs = new Map<number, number>()
  for (const row of rows) {
    const cur = row.lastUsedAt?.getTime() ?? 0
    const prev = lastMs.get(row.userId) ?? -1
    if (cur >= prev) {
      lastMs.set(row.userId, cur)
      map.set(row.userId, rowToIdentity(row))
    }
  }
  return map
}

export interface UserDisplayMeta {
  name: string | null
  email: string | null
  avatarUrl: string | null
  githubProfileUrl: string | null
}

// Batch helper for admin / aggregator endpoints. One pass over user_identities,
// returning the display meta keyed by userId. `githubProfileUrl` is derived from
// the github identity's displayName (the GitHub login) so admin UIs can keep the
// click-through to the github.com profile after the legacy column is dropped.
export async function getUserDisplayMetaMap(
  db: ReturnType<typeof useDrizzle>,
  userIds: number[],
): Promise<Map<number, UserDisplayMeta>> {
  const map = new Map<number, UserDisplayMeta>()
  if (!userIds.length)
    return map
  const rows = await db.query.userIdentities.findMany({
    where: inArray(userIdentities.userId, userIds),
  }).catch(() => [])
  const primary = new Map<number, typeof rows[number]>()
  const github = new Map<number, typeof rows[number]>()
  for (const row of rows) {
    const cur = row.lastUsedAt?.getTime() ?? 0
    const prev = primary.get(row.userId)?.lastUsedAt?.getTime() ?? -1
    if (cur >= prev)
      primary.set(row.userId, row)
    if (row.provider === 'github')
      github.set(row.userId, row)
  }
  for (const userId of userIds) {
    const p = primary.get(userId)
    const gh = github.get(userId)
    map.set(userId, {
      name: p?.displayName ?? null,
      email: p?.email ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      githubProfileUrl: gh?.displayName ? `https://github.com/${gh.displayName}` : null,
    })
  }
  return map
}

export interface UpsertIdentityInput {
  userId: number
  provider: AuthProviderId
  identity: NormalizedIdentity
}

export async function upsertIdentity(
  db: ReturnType<typeof useDrizzle>,
  input: UpsertIdentityInput,
): Promise<AuthIdentityRow> {
  const now = new Date()
  const existing = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, input.provider), eq(userIdentities.providerUserId, input.identity.providerUserId)),
  }).catch(() => null)
  if (existing) {
    await db.update(userIdentities)
      .set({
        email: input.identity.email,
        emailVerified: input.identity.emailVerified,
        displayName: input.identity.name ?? existing.displayName ?? null,
        avatarUrl: input.identity.avatarUrl ?? existing.avatarUrl ?? null,
        lastUsedAt: now,
      })
      .where(and(eq(userIdentities.provider, input.provider), eq(userIdentities.providerUserId, input.identity.providerUserId)))
      .catch(() => null)
    return rowToIdentity({ ...existing, lastUsedAt: now })
  }
  await db.insert(userIdentities).values({
    userId: input.userId,
    provider: input.provider,
    providerUserId: input.identity.providerUserId,
    email: input.identity.email,
    emailVerified: input.identity.emailVerified,
    displayName: input.identity.name ?? null,
    avatarUrl: input.identity.avatarUrl ?? null,
    linkedAt: now,
    lastUsedAt: now,
  }).catch(() => null)
  const row = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, input.provider), eq(userIdentities.providerUserId, input.identity.providerUserId)),
  })
  if (!row)
    throw new Error('upsertIdentity: insert failed')
  return rowToIdentity(row)
}

export async function disconnectIdentity(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
  provider: AuthProviderId,
): Promise<{ ok: boolean, reason?: 'last_identity' | 'not_found' }> {
  const all = await db.query.userIdentities.findMany({
    where: eq(userIdentities.userId, userId),
  }).catch(() => [])
  const target = all.find(r => r.provider === provider)
  if (!target)
    return { ok: false, reason: 'not_found' }
  if (all.length <= 1)
    return { ok: false, reason: 'last_identity' }
  await db.delete(userIdentities)
    .where(and(eq(userIdentities.userId, userId), eq(userIdentities.provider, provider)))
  return { ok: true }
}

export type AttachConflict
  = | { ok: false, reason: 'already_linked_other_user' }
    | { ok: false, reason: 'already_linked_self' }

export async function attachIdentityToUser(
  db: ReturnType<typeof useDrizzle>,
  userId: number,
  provider: AuthProviderId,
  identity: NormalizedIdentity,
): Promise<{ ok: true, identity: AuthIdentityRow } | AttachConflict> {
  // Conflict: provider account already attached to another user.
  const conflict = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.provider, provider), eq(userIdentities.providerUserId, identity.providerUserId)),
  }).catch(() => null)
  if (conflict && conflict.userId !== userId)
    return { ok: false, reason: 'already_linked_other_user' }
  if (conflict && conflict.userId === userId)
    return { ok: false, reason: 'already_linked_self' }
  const row = await upsertIdentity(db, { userId, provider, identity })
  return { ok: true, identity: row }
}
