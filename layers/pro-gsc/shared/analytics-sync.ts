import type { PartnerLifecycleSite } from './gscdump-api'
import { analyticsStatusToSyncStatus } from '@gscdump/sdk/lifecycle'

/** Readable data and a completed import are separate facts. */
export function analyticsSyncStatus(analytics: PartnerLifecycleSite['analytics']) {
  if (analytics.status === 'queryable_live' || analytics.status === 'queryable_partial')
    return 'syncing' as const
  return analyticsStatusToSyncStatus(analytics.status)
}
