// Request Indexing's half of `ProShellCommandPalette`: the fleet pages it
// offers, and the Site pages the shell's Sites group lists per Site.
//
// The Site pages come from the Site nav manifest rather than a hand-kept
// list, so the palette cannot offer a surface the sidebar does not have, and a
// flagged row (Bing) stays hidden in both while its flag is off.
import type { ProShellCommandGroup } from '@nuxtseo/pro-shell/shared/commands'
import type { ProShellSitePage } from '@nuxtseo/pro-shell/shared/sites'
import type { ProFeatureFlags } from '#layers/pro-features/shared/manifest'
import { expandProSiteRoute, proSiteFeatureChildren, proSiteFeatureManifest, proSiteFeatureNavOrder } from '#layers/pro-features/shared/manifest'
import { proNavGroups } from '#layers/pro-features/shared/nav-groups'

/** The pages outside any one Site. The shell draws them after its Sites group. */
export const PRO_FLEET_COMMAND_GROUP: ProShellCommandGroup = {
  id: 'navigation',
  label: 'Navigation',
  commands: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/pro/dashboard' },
    { id: 'indexing', label: 'Indexing (all Sites)', icon: 'database', to: '/pro/dashboard/indexing', keywords: ['submit', 'coverage', 'indexed'] },
    { id: 'manage-sites', label: 'Manage Sites', icon: 'settings', to: '/pro/dashboard/sites', keywords: ['remove', 'sites'] },
    { id: 'connect-site', label: 'Connect a Site', icon: 'add', to: '/pro/dashboard/sites/connect', keywords: ['search console', 'gsc', 'properties'] },
    { id: 'team-settings', label: 'Team settings', icon: 'settings', to: '/pro/dashboard/team/settings', keywords: ['workspace'] },
    { id: 'members', label: 'Members', icon: 'users', to: '/pro/dashboard/team/members', keywords: ['invite', 'team'] },
    { id: 'account', label: 'Account', icon: 'user', to: '/pro/dashboard/account' },
    { id: 'integrations', label: 'Integrations', icon: 'plug', to: '/pro/dashboard/integrations', keywords: ['search console', 'gsc', 'bing', 'reconnect'] },
    { id: 'developers', label: 'Developers', icon: 'terminal', to: '/pro/dashboard/developers', keywords: ['api', 'mcp', 'cli', 'gscdump'] },
  ],
}

const SITE_PLACEHOLDER = ':site'
const groupLabels = new Map(proNavGroups.map(group => [group.id, group.label]))

/**
 * The Site pages for `proShell.sitePages`: the Site overview, then every Site
 * nav row in sidebar order whose flag is on. A group's Overview row is the
 * group itself: "Indexing", not "Indexing: Overview". A deep-link-only page
 * follows the row it belongs to, so "IndexNow" still finds its page.
 */
export function proSitePalettePages(flags: ProFeatureFlags): ProShellSitePage[] {
  const root = expandProSiteRoute('/pro/dashboard/sites/:id()', SITE_PLACEHOLDER)
  const pages: ProShellSitePage[] = [{ id: 'overview', label: 'Overview', path: '' }]
  for (const featureId of proSiteFeatureNavOrder.flatMap(id => [id, ...proSiteFeatureChildren(id)])) {
    const entry = proSiteFeatureManifest[featureId]
    if ('flag' in entry && entry.flag && !flags[entry.flag])
      continue
    const group = entry.group === 'footer' ? null : groupLabels.get(entry.group)
    const label = group ? (entry.label === 'Overview' ? group : `${group}: ${entry.label}`) : entry.label
    const path = expandProSiteRoute(entry.route, SITE_PLACEHOLDER).slice(root.length).replace(/^\/+/, '')
    pages.push({ id: featureId, label, path, icon: entry.icon })
  }
  return pages
}
