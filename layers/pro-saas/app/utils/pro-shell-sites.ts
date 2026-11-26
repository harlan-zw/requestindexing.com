// Maps this app's Site rows onto the shell's `ProShellSite` once, for the nav
// source. Both `/api/sites/list` rows and `/api/pro/sites/:id` satisfy
// `ProNavSite`. Routes read the short public id (`s_…`).
import type { ProShellSite } from '@nuxtseo/pro-shell/shared/sites'
import type { ProNavSite } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import { detectPreviewSiteSignals } from '@nuxtseo/pro-shell/shared/preview-site'
import { proShellSiteHost } from '@nuxtseo/pro-shell/shared/sites'

/** The reference a Site route reads, or an empty string for a row with none. */
export function proNavSiteRef(site: ProNavSite): string {
  return site.publicId ?? site.siteId ?? site.id ?? ''
}

export function toProShellSite(site: ProNavSite, teamSiteUrls?: readonly string[]): ProShellSite {
  const ref = proNavSiteRef(site)
  const raw = site.domain || site.url || site.property || null
  const preview = raw
    ? detectPreviewSiteSignals({ url: raw, teamSiteUrls }).classification === 'likely_preview'
    : false
  return {
    id: ref,
    ref,
    name: site.name || (raw ? proShellSiteHost(raw) : '') || 'Site',
    url: raw,
    groupId: null,
    listing: 'active',
    // The sidebar roster badges a held Site; the switcher never has.
    statusLabel: null,
    emphasis: 'full',
    preview,
  }
}

/**
 * The switcher list: the roster, plus the Site the layout read from the route
 * when the roster lacks it. An identity crumb that renders nothing is worse
 * than one that cannot switch.
 */
export function proShellSiteList(roster: readonly ProNavSite[], routed: ProNavSite | null): ProShellSite[] {
  const teamSiteUrls = roster
    .map(site => site.domain || site.url || site.property || null)
    .filter((value): value is string => Boolean(value))
  const sites = roster.map(site => toProShellSite(site, teamSiteUrls))
  if (!routed)
    return sites
  const current = toProShellSite(routed, teamSiteUrls)
  return sites.some(site => site.ref === current.ref) ? sites : [current, ...sites]
}
