// The Search Console row on Integrations, as one tagged state.
//
// Ported from nuxtseo.com `layers/saas/app/utils/gsc-integration-state.ts`.
// Upstream feeds `reconnect-required` from its own record of when Google auth
// started failing. This app keeps no such record: gscdump's lifecycle already
// says it, as `account.status`, and the session reads that status (cached
// briefly, see `gscdump-account-status.ts`). So the reconnect state carries
// the status gscdump reported, not a local timestamp.

import type { AccountStatus } from '@gscdump/contracts'

type GscQueryStatus = 'idle' | 'pending' | 'success' | 'error'

/** The gscdump account statuses that only a new Google grant can clear. */
export type GscReconnectReason = Extract<AccountStatus, 'reauth_required' | 'refresh_missing'>

export interface GscIntegrationStats {
  total: number
  synced: number
  syncing: number
  pending: number
  readyToSync: number
}

/** The fields of `/api/pro/gsc-properties` this projection reads. */
export interface GscPropertiesSummary {
  connected: boolean
  properties: ReadonlyArray<{ syncStatus?: unknown, canSync?: unknown }>
  error?: { reason: string, message: string }
  stats?: GscIntegrationStats
}

// `disconnected` means no grant Search Console can use: the account never
// granted one, or gscdump holds none although this app has one on record.
// Connecting is the fix either way.
export type GscIntegrationState
  = | { _tag: 'disconnected' }
    /**
     * The grant is on record but Google stopped honouring it, so every
     * collection attempt fails until the user reconnects. Distinct from
     * `disconnected`, where no grant exists to reconnect: the fix reads
     * differently, and a retry can never clear it.
     */
    | { _tag: 'reconnect-required', reason: GscReconnectReason }
    | { _tag: 'checking' }
    | { _tag: 'ready', stats: GscIntegrationStats }
    | { _tag: 'payload-error', reason: string, message: string }
    | { _tag: 'query-error', message: string }

export interface GscIntegrationStateInput {
  /** The account holds a Search Console grant (`session.gscConnected`). */
  sessionConnected: boolean
  /** gscdump's account status as the session read it. Null when unread. */
  accountStatus: AccountStatus | null
  queryStatus: GscQueryStatus
  data?: GscPropertiesSummary | null
  queryErrorMessage?: string
}

const RECONNECT_STATUSES: ReadonlySet<AccountStatus> = new Set<GscReconnectReason>(['reauth_required', 'refresh_missing'])

/**
 * The gscdump account statuses that mean it holds no Google grant at all. Its
 * lifecycle asks for a connect here, and a retry can never clear them.
 */
const NOT_CONNECTED_STATUSES: ReadonlySet<AccountStatus> = new Set<AccountStatus>(['disconnected', 'oauth_received'])

function isReconnectReason(status: AccountStatus | null): status is GscReconnectReason {
  return !!status && RECONNECT_STATUSES.has(status)
}

// `/api/pro/gsc-properties` reads the lifecycle fresh and names the same two
// statuses with its own reason codes (`lifecycleAccountError`). Reading them
// here means a session status up to ten minutes stale cannot offer a Retry
// that has no way to succeed.
const PAYLOAD_RECONNECT_REASONS: Readonly<Record<string, GscReconnectReason>> = {
  AUTH_EXPIRED: 'reauth_required',
  MISSING_REFRESH_TOKEN: 'refresh_missing',
}

/** The reason code the same read gives for `NOT_CONNECTED_STATUSES`. */
const PAYLOAD_NOT_CONNECTED_REASON = 'GSCDUMP_NOT_CONNECTED'

function resolvedStats(data: GscPropertiesSummary): GscIntegrationStats {
  if (data.stats)
    return data.stats

  return {
    total: data.properties.length,
    synced: data.properties.filter(property => property.syncStatus === 'synced').length,
    syncing: data.properties.filter(property => property.syncStatus === 'syncing').length,
    pending: data.properties.filter(property => property.syncStatus === 'pending').length,
    readyToSync: data.properties.filter(property => property.canSync === true).length,
  }
}

export function projectGscIntegrationState(input: GscIntegrationStateInput): GscIntegrationState {
  if (!input.sessionConnected)
    return { _tag: 'disconnected' }

  // Ahead of every query-derived branch on purpose. gscdump has already said
  // the grant is dead, so a failing read must not read as a transient error
  // the user is invited to retry.
  if (isReconnectReason(input.accountStatus))
    return { _tag: 'reconnect-required', reason: input.accountStatus }
  if (input.accountStatus && NOT_CONNECTED_STATUSES.has(input.accountStatus))
    return { _tag: 'disconnected' }

  if (input.queryStatus === 'error' || input.queryErrorMessage) {
    return {
      _tag: 'query-error',
      message: input.queryErrorMessage ?? 'Search Console could not be checked. Try again.',
    }
  }

  if (input.data?.error) {
    const reconnect = PAYLOAD_RECONNECT_REASONS[input.data.error.reason]
    if (reconnect)
      return { _tag: 'reconnect-required', reason: reconnect }
    if (input.data.error.reason === PAYLOAD_NOT_CONNECTED_REASON)
      return { _tag: 'disconnected' }
    return {
      _tag: 'payload-error',
      reason: input.data.error.reason,
      message: input.data.error.message,
    }
  }

  if (input.data && !input.data.connected)
    return { _tag: 'disconnected' }

  if (input.data)
    return { _tag: 'ready', stats: resolvedStats(input.data) }

  return { _tag: 'checking' }
}
