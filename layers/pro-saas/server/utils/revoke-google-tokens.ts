// Revokes the Google OAuth tokens this app still stores for one user.
//
// `google_accounts` holds the tokens of the pooled Indexing API clients and of
// the sign-in flows before gscdump. This app holds them, so this app revokes
// them. The Search Console grant from `/auth/integrations/gsc` is not here: its
// tokens go to gscdump, and gscdump's account cleanup skips a grant a partner's
// OAuth client issued (`partner_issued`). That grant outlives the account until
// the person removes it in their Google Account, which is why the delete copy
// promises no revocation.

import type { GscError, Result } from 'gscdump'

export type RevokeGoogleToken = (token: string) => Promise<Result<void, GscError>>

export type GoogleTokenRevocation
  = | { _tag: 'NoneStored' }
    | { _tag: 'Revoked', count: number }
    | { _tag: 'Failed', revoked: number, reasons: string[] }

interface StoredToken { kind: 'refresh' | 'access', value: string }

/**
 * Revokes every stored token, one at a time. Tokens from one Google Cloud
 * project share a grant, so the first revoke ends the grant and Google answers
 * `invalid_token` for the rest. A refresh token Google calls invalid has no
 * grant behind it any more, so it counts as gone.
 */
export async function revokeStoredGoogleTokens(stored: unknown[], revoke: RevokeGoogleToken): Promise<GoogleTokenRevocation> {
  const tokens = parseStoredTokens(stored)
  if (!tokens.length)
    return { _tag: 'NoneStored' }

  let revoked = 0
  const reasons: string[] = []
  for (const token of tokens) {
    const result = await revoke(token.value)
    const reason = failureReason(token, result)
    if (reason)
      reasons.push(reason)
    else
      revoked++
  }
  return reasons.length
    ? { _tag: 'Failed', revoked, reasons }
    : { _tag: 'Revoked', count: revoked }
}

function failureReason(token: StoredToken, result: Result<void, GscError>): string | null {
  if (result.ok)
    return null
  // An access token expires after an hour while its grant lives on, so Google
  // calling it invalid proves nothing about the grant.
  if (result.error.kind === 'auth-expired')
    return token.kind === 'refresh' ? null : 'access token invalid: grant not revoked'
  return `${result.error.kind}: ${result.error.message}`
}

// `google_accounts.tokens` is JSON written by several generations of the app.
// Prefer the refresh token: revoking it ends the grant. Drop duplicates so one
// token is never revoked twice.
function parseStoredTokens(stored: unknown[]): StoredToken[] {
  const tokens = new Map<string, StoredToken>()
  for (const entry of stored) {
    const record = typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : {}
    const token: StoredToken | null = nonEmpty(record.refresh_token)
      ? { kind: 'refresh', value: record.refresh_token }
      : nonEmpty(record.access_token)
        ? { kind: 'access', value: record.access_token }
        : null
    if (token)
      tokens.set(token.value, token)
  }
  return [...tokens.values()]
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
