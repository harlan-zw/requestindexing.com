// gscdump's account status, read at the point of decision and cached briefly.
//
// The status is the engine's record, so it is never mirrored onto a column.
// A column would need a writer for every transition gscdump makes, and a
// missed webhook would leave it wrong for good. A short cache bounds the cost
// instead: at most one lifecycle read per user per max age, well inside the
// 120 per minute the partner key gets for `partner.users.lifecycle.get`.

import type { AccountStatus } from '@gscdump/contracts'
import { accountStatuses } from '@gscdump/contracts'

/** How long a successful read answers for the user. */
export const ACCOUNT_STATUS_MAX_AGE_MS = 10 * 60_000

/**
 * How long a failed read answers as "unknown". Short, so a recovered engine is
 * seen quickly, but long enough that an outage costs one call a minute per
 * user rather than one per request.
 */
export const FAILED_READ_MAX_AGE_MS = 60_000

export type CachedAccountStatus
  = | { _tag: 'Read', status: AccountStatus, readAt: number }
    | { _tag: 'Failed', readAt: number }

export type AccountStatusLookup
  = | { _tag: 'Hit', status: AccountStatus | null }
    | { _tag: 'Miss' }

function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (accountStatuses as readonly string[]).includes(value)
}

function parseCachedAccountStatus(value: unknown): CachedAccountStatus | null {
  if (typeof value !== 'object' || value === null)
    return null
  const record = value as Record<string, unknown>
  if (typeof record.readAt !== 'number' || !Number.isFinite(record.readAt))
    return null
  if (record._tag === 'Failed')
    return { _tag: 'Failed', readAt: record.readAt }
  if (record._tag === 'Read' && isAccountStatus(record.status))
    return { _tag: 'Read', status: record.status, readAt: record.readAt }
  return null
}

/**
 * Decide whether a stored entry still answers. Storage is untrusted: an entry
 * this code cannot read, or one stamped in the future, is a miss.
 */
export function lookupCachedAccountStatus(value: unknown, now: number): AccountStatusLookup {
  const entry = parseCachedAccountStatus(value)
  if (!entry || entry.readAt > now)
    return { _tag: 'Miss' }
  const age = now - entry.readAt
  if (entry._tag === 'Read')
    return age <= ACCOUNT_STATUS_MAX_AGE_MS ? { _tag: 'Hit', status: entry.status } : { _tag: 'Miss' }
  return age <= FAILED_READ_MAX_AGE_MS ? { _tag: 'Hit', status: null } : { _tag: 'Miss' }
}
