import type { SiteHoldReason } from '@gscdump/contracts'
import type { SiteSyncStatus } from './site-sync'

export const MANAGE_SITES_FILTER_THRESHOLD = 8
export const SIDEBAR_SITES_CAP = 12

export type ManageSitesFilter = 'all' | 'attention'

export interface TriageableSiteRow {
  readonly label: string
  readonly property: string
  readonly hold: SiteHoldReason | null
  readonly refused: boolean
  readonly syncStatus: SiteSyncStatus
}

/** A Site that needs operator attention in Manage Sites or sidebar prioritization. */
export function siteNeedsAttention(row: Pick<TriageableSiteRow, 'hold' | 'refused' | 'syncStatus'>): boolean {
  return Boolean(row.hold || row.refused || row.syncStatus === 'error' || row.syncStatus === 'partial')
}

/** Filter Manage Sites rows by attention status and case-insensitive search query. */
export function filterManageSites<T extends TriageableSiteRow>(
  rows: readonly T[],
  options: { filter: ManageSitesFilter, query: string },
): T[] {
  const query = options.query.trim().toLowerCase()
  return rows.filter((row) => {
    if (options.filter === 'attention' && !siteNeedsAttention(row))
      return false
    if (!query)
      return true
    return row.label.toLowerCase().includes(query) || row.property.toLowerCase().includes(query)
  })
}

export interface SidebarSiteEntry {
  readonly to: string
  readonly hold?: string | null
  readonly syncStatus?: SiteSyncStatus | null
}

export interface SidebarSiteSelection<T> {
  readonly visible: T[]
  readonly total: number
  readonly capped: boolean
}

function isSidebarSiteActive(to: string, activePath: string): boolean {
  return activePath === to || activePath.startsWith(`${to}/`)
}

function isSidebarAttentionSite(site: SidebarSiteEntry): boolean {
  return Boolean(
    site.hold
    || site.syncStatus === 'error'
    || site.syncStatus === 'partial'
    || site.syncStatus === 'refused',
  )
}

/**
 * Bound the fleet sidebar roster so the bottom Manage rail never scrolls off-screen.
 * When capped, keep the active Site first, then held or attention Sites, then the rest in order.
 */
export function selectSidebarSites<T extends SidebarSiteEntry>(
  links: readonly T[],
  options: { activePath: string, cap?: number },
): SidebarSiteSelection<T> {
  const cap = options.cap ?? SIDEBAR_SITES_CAP
  if (links.length <= cap)
    return { visible: [...links], total: links.length, capped: false }

  const active: T[] = []
  const attention: T[] = []
  const rest: T[] = []

  for (const link of links) {
    if (isSidebarSiteActive(link.to, options.activePath))
      active.push(link)
    else if (isSidebarAttentionSite(link))
      attention.push(link)
    else
      rest.push(link)
  }

  return {
    visible: [...active, ...attention, ...rest].slice(0, cap),
    total: links.length,
    capped: true,
  }
}
