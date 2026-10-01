import type { AccountStatus } from '@gscdump/contracts'
import type { CachedAccountStatus } from '../../shared/gscdump-account-status'
import { logger } from '~~/shared/server/logger'
import { lookupCachedAccountStatus } from '../../shared/gscdump-account-status'
import { RENDER_PATH_TIMEOUT_MS, useGscdumpClient } from './gscdump-client'

function cacheKey(gscdumpUserId: string): string {
  return `gscdump-account-status:${gscdumpUserId}`
}

async function store(gscdumpUserId: string, entry: CachedAccountStatus): Promise<void> {
  await useStorage('cache').setItem(cacheKey(gscdumpUserId), entry)
}

/** Record a lifecycle read made elsewhere, so the next session skips its own. */
export async function rememberGscdumpAccountStatus(gscdumpUserId: string, status: AccountStatus): Promise<void> {
  await store(gscdumpUserId, { _tag: 'Read', status, readAt: Date.now() })
}

/** Drop the cached status after the grant changed, so the next read goes to gscdump. */
export async function forgetGscdumpAccountStatus(gscdumpUserId: string): Promise<void> {
  await useStorage('cache').removeItem(cacheKey(gscdumpUserId))
}

/**
 * gscdump's account status for this user, or null when gscdump could not
 * answer. A null never blocks the caller: the stored credential decides, which
 * is what every session did before this read existed.
 *
 * The session fetch hook waits on this before a signed-in page renders, so the
 * read has the render-path deadline. A read that misses it caches as `Failed`.
 */
export async function readGscdumpAccountStatus(gscdumpUserId: string): Promise<AccountStatus | null> {
  const cached = lookupCachedAccountStatus(await useStorage('cache').getItem(cacheKey(gscdumpUserId)), Date.now())
  if (cached._tag === 'Hit')
    return cached.status

  const status = await useGscdumpClient({ timeoutMs: RENDER_PATH_TIMEOUT_MS }).getUserLifecycle(gscdumpUserId).then(lifecycle => lifecycle.account.status).catch((error: unknown) => {
    logger.error('[gscdump account status] lifecycle read failed, status unknown for:', gscdumpUserId, error)
    return null
  })

  await store(gscdumpUserId, status ? { _tag: 'Read', status, readAt: Date.now() } : { _tag: 'Failed', readAt: Date.now() })
  return status
}
