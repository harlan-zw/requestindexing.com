import type { H3Event } from 'h3'

export type AuthProviderId = 'github' | 'google'

export interface NormalizedIdentity {
  providerUserId: string
  email: string | null
  emailVerified: boolean
  // True when the provider's email endpoint was unreachable, so verification
  // could not be read at all. Kept apart from `emailVerified: false`, because
  // telling the user to verify an email they already verified misleads them.
  emailLookupFailed?: boolean
  name?: string | null
  avatarUrl?: string | null
  allVerifiedEmails: string[]
}

export interface AuthIdentityRow {
  userId: number
  provider: AuthProviderId
  providerUserId: string
  email: string | null
  emailVerified: boolean
  displayName: string | null
  avatarUrl: string | null
  linkedAt: Date | null
  lastUsedAt: Date | null
}

export interface SessionUser {
  id: number
  email: string | null
  name: string | null
  avatarUrl: string | null
  authProvider: AuthProviderId
  currentTeamId: number | null
}

export interface AuthHookContextBase {
  event: H3Event
  user: { id: number, source: string | null }
  identity: AuthIdentityRow
  sourceCookie?: 'pro-free' | null
}

export interface AuthHooks {
  'user:created': (ctx: AuthHookContextBase & { isNewUser: true }) => void | Promise<void>
  'user:signed-in': (ctx: AuthHookContextBase) => void | Promise<void>
  'user:identity-linked': (ctx: AuthHookContextBase) => void | Promise<void>
  'user:identity-removed': (ctx: { event: H3Event, userId: number, provider: AuthProviderId }) => void | Promise<void>
}
