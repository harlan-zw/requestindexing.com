// Ported from nuxtseo.com's `layers/saas/app/utils/site-switch.ts`, plus the
// identity rule the switcher needs. Pure, so the tests call it directly.
import type { ProNavSite } from '#layers/pro-shell/app/composables/useProSingleSiteNav'

export interface SiteSwitchRoute {
  path: string
  fullPath: string
}

/**
 * Keep the current site-scoped page while swapping only the site id segment.
 */
export function buildSiteSwitchPath(route: SiteSwitchRoute, currentSiteParam: string, nextSiteParam: string) {
  const currentBase = `/pro/dashboard/sites/${encodeURIComponent(currentSiteParam)}`
  const nextBase = `/pro/dashboard/sites/${encodeURIComponent(nextSiteParam)}`
  const queryAndHash = route.fullPath.startsWith(route.path) ? route.fullPath.slice(route.path.length) : ''

  if (route.path === currentBase || route.path.startsWith(`${currentBase}/`))
    return `${nextBase}${route.path.slice(currentBase.length)}${queryAndHash}`

  return nextBase
}

/** What the switcher shows for one Site. */
export interface SiteSwitchIdentity {
  /** The route segment: the public id (`s_…`), as every Site link uses. */
  ref: string
  label: string
  /** Hostname for the favicon, or `''` when the Site has none. */
  domain: string
}

function hostnameOf(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
  }
  catch {
    return value
  }
}

/**
 * The same name and host rule `useProSingleSiteNav` applies to the sidebar
 * header row, so the header crumb and the sidebar name the Site alike.
 */
export function siteSwitchIdentity(site: ProNavSite): SiteSwitchIdentity {
  const raw = site.domain || site.url || site.property || ''
  const domain = raw ? hostnameOf(raw) : ''
  return {
    ref: site.publicId ?? site.siteId ?? site.id ?? '',
    label: site.name || domain || 'Site',
    domain,
  }
}
