// Single source of truth for every Site nav row.
//
// Ported from nuxtseo.com's `modules/pro-features/src/runtime/shared/manifest.ts`,
// with one difference that follows from owner decision 10: upstream declares one
// entry per tabbed feature and hardcodes the tab strip inside the feature's
// parent route. Here every row the reader can click is its own entry, so the
// sidebar is the whole IA and no second array can drift from it.
//
// Runtime-neutral on purpose. It is emitted into both the app and the Nitro
// graph as `#pro-features/manifest`, so a server handler and the sidebar read the
// same declaration. Presentation concerns (state resolvers, chrome components)
// stay in each layer's `app/plugins/pro-feature.ts`.

import type { UiIcon } from '@nuxtseo/design-system/shared/icons'
import type { IntegrationReadiness } from '#layers/pro-saas/shared/policies/integration-readiness'
import type { ProNavGroupId } from './nav-groups'
import { WEBMASTER_TOOLS, WEBMASTER_TOOLS_TABS } from '@nuxtseo/pro-search/shared/navigation'

/**
 * Names a runtime flag that must be on before the row exists.
 *
 * `bing` is the only one today: the two Bing surfaces are declared so the IA is
 * complete and reviewable, but gscdump has not shipped the partner operations
 * behind them. The flag reads from `runtimeConfig.public.features` and is off
 * unless `NUXT_PUBLIC_FEATURES_BING=true` is set.
 */
export type ProFeatureFlag = 'bing'

/** Static, runtime-neutral definition of one Site nav row. */
export interface ProSiteFeatureManifestEntry {
  /** The row label, which is also the page H1. One surface, one name. */
  label: string
  icon: UiIcon
  group: ProNavGroupId | null
  /** Global order in the Site sidebar. `null` means a deep-link-only surface. */
  order: number | null
  /** Absolute Site route template. `:id()` is replaced by the Site public id. */
  route: string
  /**
   * External-account state this surface reads. The only authorization concept
   * left in this app (ADR-0025): a render directive, never a security check.
   * There is no tier and no monitoring gate, because the product is free and
   * has one plan.
   */
  integration?: IntegrationReadiness
  flag?: ProFeatureFlag
  /**
   * The nav row a deep-link-only surface (`order: null`) belongs to. That row
   * stays lit while the surface is open, and the command palette lists the
   * surface under it. Never set on a row that has its own place in the nav.
   */
  parent?: string
}

const SITE_ROOT = '/pro/dashboard/sites/:id()'

export const proSiteFeatureManifest = {
  // ── Search Performance ──
  'search-console': {
    label: 'Overview',
    icon: 'google',
    group: 'search',
    order: 10,
    route: `${SITE_ROOT}/search-console`,
    integration: 'gsc-connected',
  },
  'search-console.queries': {
    label: 'Queries',
    icon: 'search',
    group: 'search',
    order: 12,
    route: `${SITE_ROOT}/search-console/queries`,
    integration: 'gsc-connected',
  },
  'search-console.pages': {
    label: 'Pages',
    icon: 'file-text',
    group: 'search',
    order: 14,
    route: `${SITE_ROOT}/search-console/pages`,
    integration: 'gsc-connected',
  },
  'search-console.countries': {
    label: 'Countries',
    icon: 'globe',
    group: 'search',
    order: 16,
    route: `${SITE_ROOT}/search-console/countries`,
    integration: 'gsc-connected',
  },

  // ── Indexing ──
  'indexing': {
    label: 'Overview',
    icon: 'database',
    group: 'indexing',
    order: 30,
    route: `${SITE_ROOT}/indexing`,
    integration: 'gsc-connected',
  },
  // Every Submission on every channel, and the sitemap submission. Second in the
  // group because it is what the reader came to do (design note
  // submission-value-design-2026-11-18). The two channel pages below are its
  // deep links: each is a whole flow (a grant, a key file), so they stay pages
  // of their own instead of folding into this one (owner decision 10).
  'indexing.submissions': {
    label: 'Submissions',
    icon: 'send',
    group: 'indexing',
    order: 31,
    route: `${SITE_ROOT}/indexing/submissions`,
  },
  'indexing.recovery': {
    label: 'Recovery',
    icon: 'refresh',
    group: 'indexing',
    order: 32,
    route: `${SITE_ROOT}/indexing/recovery`,
    integration: 'gsc-connected',
  },
  'indexing.sitemaps': {
    label: 'Sitemaps',
    icon: 'map',
    group: 'indexing',
    order: 34,
    route: `${SITE_ROOT}/indexing/sitemaps`,
    integration: 'gsc-connected',
  },
  'indexing.urls': {
    label: 'URLs',
    icon: 'link',
    group: 'indexing',
    order: 36,
    route: `${SITE_ROOT}/indexing/urls`,
    integration: 'gsc-connected',
  },
  'indexing.watched': {
    label: 'Watched URLs',
    icon: 'clock',
    group: 'indexing',
    order: 37,
    route: `${SITE_ROOT}/indexing/watched`,
    integration: 'gsc-connected',
  },
  // The namesake action, reached from Submissions. It runs on this account's
  // pooled Google client, not on gscdump, so it carries no integration
  // prerequisite of its own. The label names Google because IndexNow also
  // submits URLs, to other search engines (COPY.md, "Indexing channel assets").
  'indexing.submit': {
    label: 'Submit to Google',
    icon: 'send',
    group: 'indexing',
    order: null,
    route: `${SITE_ROOT}/indexing/submit`,
    parent: 'indexing.submissions',
  },
  'indexing.indexnow': {
    label: 'IndexNow',
    icon: 'send',
    group: 'indexing',
    order: null,
    route: `${SITE_ROOT}/indexing/indexnow`,
    parent: 'indexing.submissions',
  },
  'webmaster-tools': {
    ...WEBMASTER_TOOLS,
    group: 'webmaster-tools',
    order: 40,
    route: `${SITE_ROOT}/webmaster-tools`,
    integration: 'gsc-connected',
    flag: 'bing',
  },
  'webmaster-tools.crawl': {
    label: WEBMASTER_TOOLS_TABS[1].label,
    icon: WEBMASTER_TOOLS.icon,
    group: 'webmaster-tools',
    order: null,
    route: `${SITE_ROOT}/webmaster-tools/crawl`,
    parent: 'webmaster-tools',
    integration: 'gsc-connected',
    flag: 'bing',
  },

  // ── Settings ──
  'site-settings': {
    label: 'Site settings',
    icon: 'settings',
    group: 'footer',
    order: 90,
    route: `${SITE_ROOT}/settings`,
  },
} as const satisfies Record<string, ProSiteFeatureManifestEntry>

export type ProSiteFeatureId = keyof typeof proSiteFeatureManifest

export type ProSiteFeatureDefinition<Id extends ProSiteFeatureId = ProSiteFeatureId>
  = { id: Id } & (typeof proSiteFeatureManifest)[Id]

const proSiteFeatureIds = Object.keys(proSiteFeatureManifest) as ProSiteFeatureId[]

/** Sidebar order derived from the entries, so it cannot omit a grouped row. */
export const proSiteFeatureNavOrder: readonly ProSiteFeatureId[] = proSiteFeatureIds
  .filter(id => proSiteFeatureManifest[id].order !== null)
  .sort((a, b) => proSiteFeatureManifest[a].order! - proSiteFeatureManifest[b].order!)

/** The deep-link-only surfaces that belong to a nav row, in declaration order. */
export function proSiteFeatureChildren(id: ProSiteFeatureId): ProSiteFeatureId[] {
  return proSiteFeatureIds.filter(other => (proSiteFeatureManifest[other] as ProSiteFeatureManifestEntry).parent === id)
}

export function getProSiteFeatureDefinition<Id extends ProSiteFeatureId>(
  id: Id,
): ProSiteFeatureDefinition<Id> {
  return { id, ...proSiteFeatureManifest[id] } as ProSiteFeatureDefinition<Id>
}

/**
 * Entry for a runtime id, or `null` for an id the manifest does not know.
 *
 * Takes a `string` because callers hold a registered feature's runtime id.
 * `null` means "not a manifest row", never "no prerequisite": a guard reading
 * `null` must fail closed rather than assume the surface is open.
 */
export function findProSiteFeatureEntry(id: string): ProSiteFeatureManifestEntry | null {
  return (proSiteFeatureManifest as Record<string, ProSiteFeatureManifestEntry | undefined>)[id] ?? null
}

/** Replace the route template's Site parameter with a concrete public id. */
export function expandProSiteRoute(route: string, siteId: string): string {
  return route.replace(/:id\(\)|:slug\(\)|\[id\]|\[slug\]/g, siteId)
}

/**
 * Which flagged rows are on. Absent means off. The defaults live in
 * `runtimeConfig.public.features` in nuxt.config.ts.
 */
export type ProFeatureFlags = Partial<Record<ProFeatureFlag, boolean>>

const PRO_FEATURE_FLAG_NAMES: readonly ProFeatureFlag[] = ['bing']

/**
 * Parse a public runtime config block into feature flags.
 *
 * One reader for the sidebar, the route guard and the server proxy, so a flag
 * cannot mean three things. Anything that is not the literal `true` is off:
 * `NUXT_PUBLIC_FEATURES_BING` arrives as a string in some deployments, and a
 * non-empty string like `"false"` must not read as on.
 */
export function readProFeatureFlags(publicConfig: unknown): ProFeatureFlags {
  const features = (publicConfig as { features?: unknown } | null | undefined)?.features
  if (!features || typeof features !== 'object')
    return {}
  const source = features as Record<string, unknown>
  const flags: ProFeatureFlags = {}
  for (const name of PRO_FEATURE_FLAG_NAMES)
    flags[name] = source[name] === true || source[name] === 'true'
  return flags
}

/** Route templates that carry a flag, compiled once into path matchers. */
const FLAGGED_ROUTE_MATCHERS: readonly { flag: ProFeatureFlag, match: RegExp }[] = proSiteFeatureIds
  .flatMap((id) => {
    const entry = proSiteFeatureManifest[id] as ProSiteFeatureManifestEntry
    if (!entry.flag)
      return []
    const pattern = entry.route
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:id\\\(\\\)/g, '[^/]+')
    return [{ flag: entry.flag, match: new RegExp(`^${pattern}/?$`) }]
  })

/**
 * The flag a path requires, or `null` when the path is not flagged.
 *
 * Derived from the manifest rather than declared on each page, so a flagged
 * surface cannot ship reachable because someone forgot the page meta.
 */
export function requiredProFeatureFlag(path: string): ProFeatureFlag | null {
  const clean = path.split('?')[0]!.split('#')[0]!
  if (/^\/pro\/dashboard\/webmaster-tools\/?$/.test(clean) || /^\/pro\/dashboard\/sites\/[^/]+\/(?:search-console|indexing)\/bing\/?$/.test(clean))
    return 'bing'
  return FLAGGED_ROUTE_MATCHERS.find(entry => entry.match.test(clean))?.flag ?? null
}

/**
 * Every flag on, for a renderer that hands each flagged row to a gate instead
 * of dropping it. The sidebar does this: the `@nuxtseo/pro-shell` nav reads
 * the flag through the nav source's `hasFeature`, and hides the row there.
 */
export const ALL_PRO_FEATURE_FLAGS_ON: ProFeatureFlags = Object.fromEntries(PRO_FEATURE_FLAG_NAMES.map(name => [name, true]))

/** The flag a Site feature row needs before it exists, or null when it needs none. */
export function proSiteFeatureFlag(id: string): ProFeatureFlag | null {
  const entry = (proSiteFeatureManifest as Record<string, { flag?: ProFeatureFlag }>)[id]
  return entry?.flag ?? null
}
