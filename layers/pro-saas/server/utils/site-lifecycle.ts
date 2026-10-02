// Shared gscdump-lifecycle helpers for the `/api/sites/*` family. Centralizes
// the "match a local site row against its gscdump lifecycle entry" logic used
// by list/preview/stats so each route only needs to fetch the lifecycle once
// per request and reuse the same derivation.
import type { PartnerLifecycleResponse, PartnerLifecycleSite } from '#layers/pro-gsc/shared/gscdump-api'
import { getOldestGscDate } from 'gscdump'
import { findLifecycleSite } from '#layers/pro-gsc/server/utils/gscdump-client'
import { analyticsSyncStatus } from '#layers/pro-gsc/shared/analytics-sync'

/** `refused`: gscdump refused to register the Site; it waits for the user. */
export type SiteSyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'refused'

export function lifecycleSiteFor(lifecycle: PartnerLifecycleResponse | null, gscdumpSiteId: string | null): PartnerLifecycleSite | null {
  if (!lifecycle || !gscdumpSiteId)
    return null
  return findLifecycleSite(lifecycle, gscdumpSiteId)
}

export function syncStatusFor(lifecycleSite: PartnerLifecycleSite | null, fallback: SiteSyncStatus | null): SiteSyncStatus {
  if (lifecycleSite)
    return analyticsSyncStatus(lifecycleSite.analytics)
  return fallback ?? 'pending'
}

/** True once the oldest synced date is at (or past) GSC's retention cliff, so older rows are starting to roll off. */
export function isNearRetentionLimit(oldestSyncedDate: string | null): boolean {
  if (!oldestSyncedDate)
    return false
  return oldestSyncedDate <= getOldestGscDate()
}

/**
 * The outcome of an optional gscdump lifecycle read, as a value.
 *
 * `Skipped` and `Unavailable` are different facts: the first means the caller
 * has no gscdump account, the second means the read could not be made. Callers
 * fall back to their stored sync status either way, but only `Unavailable`
 * carries a reason worth logging.
 */
export type OptionalLifecycleRead<R extends LifecycleReader = LifecycleReader>
  = | { _tag: 'Skipped' }
    | { _tag: 'Loaded', lifecycle: PartnerLifecycleResponse, reader: R }
    | { _tag: 'Unavailable', reason: string }

/** The one gscdump operation an optional lifecycle read needs. */
export interface LifecycleReader {
  getUserLifecycle: (userId: string) => Promise<PartnerLifecycleResponse>
}

/**
 * Read a caller's gscdump lifecycle without letting gscdump decide whether the
 * request succeeds.
 *
 * Every roster route wants the same thing: the lifecycle when it is there, the
 * stored sync status when it is not. Routes expressed that as
 * `useGscdumpClient().getUserLifecycle(id).catch(() => null)`, which reads as
 * total but is not: the factory runs before the promise exists, so a partner
 * key that is absent or a base URL that will not parse throws past the catch
 * and answers 500. `/api/sites/list` is the roster the dashboard page and the
 * dashboard shell both await, so that 500 took the whole signed-in dashboard
 * with it while anonymous traffic was fine.
 *
 * Taking the factory as an argument puts construction inside the boundary, so
 * no caller can place it outside one. The built reader rides on `Loaded`, so a
 * route that needs more gscdump reads gets the client only on the path where
 * gscdump answered.
 */
export async function readOptionalUserLifecycle<R extends LifecycleReader>(
  gscdumpUserId: string | null | undefined,
  createReader: () => R,
): Promise<OptionalLifecycleRead<R>> {
  if (!gscdumpUserId)
    return { _tag: 'Skipped' }

  try {
    const reader = createReader()
    return { _tag: 'Loaded', lifecycle: await reader.getUserLifecycle(gscdumpUserId), reader }
  }
  catch (error) {
    return { _tag: 'Unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}

/** The lifecycle a read produced, or null when there is none to read. */
export function lifecycleOf(read: OptionalLifecycleRead<LifecycleReader>): PartnerLifecycleResponse | null {
  return read._tag === 'Loaded' ? read.lifecycle : null
}
