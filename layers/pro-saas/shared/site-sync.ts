import type { SiteFleetRow } from '~~/layers/core/app/types'

export type SiteSyncStatus = SiteFleetRow['syncStatus']

/** The one wording of a Site's Search Console sync status. */
export const SITE_SYNC_LABELS: Record<SiteSyncStatus, string> = {
  idle: 'Waiting to sync',
  pending: 'Waiting to sync',
  syncing: 'Syncing',
  synced: 'Synced',
  error: 'Sync failed',
}

/** A first sync is queued or running, so the Site has no data to show yet. */
export function isSiteSyncing(status: SiteSyncStatus): boolean {
  return status === 'pending' || status === 'syncing'
}
