// Server side of the Free allowance: read a user's gscdump entitlements, and
// turn a refusal into the API error this app's routes answer with.
import type { EntitlementRefusal } from '@gscdump/contracts'
import type { PartnerUserEntitlementsV1 } from '@gscdump/contracts/v1'
import type { EntitlementsRead } from '../../shared/free-allowance'
import { ProError } from '#layers/pro-saas/shared/errors'
import { refusalMessage } from '../../shared/entitlement-copy'

/** The one gscdump operation an entitlements read needs. */
export interface EntitlementsReader {
  getUserEntitlements: (userId: string) => Promise<PartnerUserEntitlementsV1>
}

/**
 * Read a user's entitlements without letting gscdump decide whether the
 * request succeeds. Same shape as `readOptionalUserLifecycle`: the reader is
 * built inside the boundary, so a missing partner key lands on `Unavailable`
 * and never on a 500.
 */
export async function readOptionalUserEntitlements(
  gscdumpUserId: string | null | undefined,
  createReader: () => EntitlementsReader,
): Promise<EntitlementsRead> {
  if (!gscdumpUserId)
    return { _tag: 'Skipped' }

  try {
    return { _tag: 'Loaded', entitlements: await createReader().getUserEntitlements(gscdumpUserId) }
  }
  catch (error) {
    return { _tag: 'Unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The API error for a refusal. The message is this app's copy; the refusal
 * rides in `details` so the client can branch on `reason` without parsing
 * prose. The monthly URL Inspection allowance stays a 429, as gscdump sends it.
 */
export function refusalError(refusal: EntitlementRefusal): ProError {
  return new ProError(refusal.reason === 'inspection_allowance' ? 'rate_limited' : 'conflict', {
    message: refusalMessage(refusal),
    details: refusal,
  })
}
