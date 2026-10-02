import type { H3Event } from 'h3'
import type { VerificationCaller, VerificationDeps } from './property-verification'
import { readCallerGscdumpConnection } from '#layers/pro-saas/server/utils/caller-rows'
import { getProLogger } from '#layers/pro-saas/server/utils/handler'
import { DEFAULT_PARTNER_TIMEOUT_MS, useGscdumpClient } from './gscdump-client'
import { createGscdumpPublicV1Client } from './gscdump-origin'
import { gscdumpVerificationEngine } from './property-verification'
import { hasGscdumpConnection } from './search-console-properties'

/**
 * The effectful shell of Add and verify: the caller's gscdump user, the v1
 * client with the partner key, the clock, and the request logger. The three
 * `/api/pro/gsc-verification` routes build it once each.
 */
export async function propertyVerificationContext(
  event: H3Event,
  db: VerificationDeps['db'],
  userId: number,
): Promise<{ deps: VerificationDeps, caller: VerificationCaller }> {
  const connection = await readCallerGscdumpConnection(event, db, userId)
  const gscdump = useGscdumpClient()
  const logger = getProLogger(event)
  return {
    caller: { userId, gscdumpUserId: hasGscdumpConnection(connection) ? connection.gscdumpUserId : null },
    deps: {
      db,
      engine: {
        ...gscdumpVerificationEngine(createGscdumpPublicV1Client(event), { timeoutMs: DEFAULT_PARTNER_TIMEOUT_MS }),
        readGrantedScopes: gscdumpUserId => gscdump.getUserLifecycle(gscdumpUserId).then(lifecycle => lifecycle.account.grantedScopes),
      },
      now: () => new Date(),
      warn: (message, detail) => logger.warn(message, detail),
    },
  }
}
