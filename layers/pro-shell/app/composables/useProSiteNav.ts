// Builds the Site sidebar for /pro/dashboard/sites/[id]/* from the static nav
// manifest. Ported from nuxtseo.com's `useProSiteNav`, minus the tier and
// monitoring partitions: this app is free, has one plan, and keeps exactly one
// authorization concept, integration readiness (ADR-0025).
//
// An unmet integration stays clickable and renders a waiting dot, as upstream
// does: a surface the reader cannot use yet is still a surface they should be
// able to look at.
//
// Nothing here reads the feature registry. Identity, route, group and order are
// manifest facts, so the sidebar cannot disagree with what a server handler or
// a deep link resolves for the same row.

import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { UiIcon } from '#layers/design-system/shared/icons'
import type { IntegrationReadiness } from '#layers/pro-saas/shared/policies/integration-readiness'
import type { ProFeatureFlags, ProSiteFeatureId } from '../../shared/manifest'
import type { ProNavGroupDef } from '../../shared/nav-groups'
import { computed, toValue } from 'vue'
import {
  expandProSiteRoute,
  proSiteFeatureManifest,
  proSiteFeatureNavOrder,
} from '../../shared/manifest'
import { proNavGroups } from '../../shared/nav-groups'

export interface ProSiteNavLink {
  id: string
  label: string
  icon?: UiIcon
  to: string
  active?: (path: string) => boolean
  /**
   * The row's integration is reported unmet. Renders a waiting dot; the row
   * stays clickable so the reader can read the connect prompt on the page.
   */
  pending?: boolean
  pendingTooltip?: string
  /** Set by consumers (see `useProSingleSiteNav`), never by the manifest. */
  badge?: string
  badgeColor?: 'primary' | 'warning'
  setup?: { verb: string, tooltip: string, tone?: 'primary' | 'warning' } | null
}

export interface ProNavSection extends ProNavGroupDef {
  links: ProSiteNavLink[]
}

export type ProSiteNavFlags = ProFeatureFlags

export interface ProSiteNavOptions {
  /**
   * Reports whether an integration prerequisite is currently unmet. Return a
   * descriptor to mark the row waiting, or `null`/`false` when it is satisfied.
   * Called inside the nav computed, so it may read reactive flags but must not
   * call a composable.
   */
  pending?: (integration: IntegrationReadiness) => { tooltip?: string } | null | false
  /**
   * Skip the synthesized pinned Overview link. The single-site sidebar replaces
   * it with the favicon plus site-name header row.
   */
  overviewLink?: boolean
  /**
   * Which flagged rows are on. Passed in rather than read from runtime config
   * here, so this composable needs no Nuxt instance and the app has exactly one
   * place that decides what a flag means (`useProSingleSiteNav`). Omitting it
   * means every flagged row is off, which is also the production state.
   */
  flags?: MaybeRefOrGetter<ProSiteNavFlags>
}

/**
 * Rows whose route is a prefix of another row's route match the path exactly.
 * Search Performance Overview sits at `/search-console`, and Queries at
 * `/search-console/queries`, so prefix matching would light both.
 */
const EXACT_MATCH_IDS = new Set<string>(
  proSiteFeatureNavOrder.filter(id => proSiteFeatureNavOrder.some(other =>
    other !== id && proSiteFeatureManifest[other].route.startsWith(`${proSiteFeatureManifest[id].route}/`),
  )),
)

function matcher(id: ProSiteFeatureId, to: string) {
  return EXACT_MATCH_IDS.has(id)
    ? (path: string) => path === to
    : (path: string) => path === to || path.startsWith(`${to}/`)
}

export function useProSiteNav(
  siteId: MaybeRefOrGetter<string>,
  options: ProSiteNavOptions = {},
): {
  pinnedLinks: ComputedRef<ProSiteNavLink[]>
  sections: ComputedRef<ProNavSection[]>
  footerLinks: ComputedRef<ProSiteNavLink[]>
} {
  const flags = computed<ProSiteNavFlags>(() => toValue(options.flags) ?? {})

  const linksByGroup = computed<Map<string, ProSiteNavLink[]>>(() => {
    const byGroup = new Map<string, ProSiteNavLink[]>()
    const id = toValue(siteId)
    if (!id)
      return byGroup

    for (const featureId of proSiteFeatureNavOrder) {
      const entry = proSiteFeatureManifest[featureId]
      if (!entry.group)
        continue
      // A flagged row does not exist while its flag is off: no sidebar entry,
      // and nothing that hints one is being withheld.
      if ('flag' in entry && entry.flag && !flags.value[entry.flag])
        continue

      const to = expandProSiteRoute(entry.route, id)
      const integration = 'integration' in entry ? entry.integration as IntegrationReadiness : undefined
      const pendingState = integration ? options.pending?.(integration) : null
      const link: ProSiteNavLink = {
        id: featureId,
        label: entry.label,
        icon: entry.icon,
        to,
        active: matcher(featureId, to),
        pending: !!pendingState,
        pendingTooltip: pendingState ? pendingState.tooltip : undefined,
      }
      const list = byGroup.get(entry.group)
      if (list)
        list.push(link)
      else
        byGroup.set(entry.group, [link])
    }
    return byGroup
  })

  const pinnedLinks = computed<ProSiteNavLink[]>(() => {
    const id = toValue(siteId)
    if (!id)
      return []
    const base = `/pro/dashboard/sites/${id}`
    const out: ProSiteNavLink[] = options.overviewLink === false
      ? []
      : [{ id: 'overview', label: 'Overview', icon: 'home', to: base, active: p => p === base }]
    for (const group of proNavGroups) {
      if (group.pinned)
        out.push(...(linksByGroup.value.get(group.id) ?? []))
    }
    return out
  })

  const sections = computed<ProNavSection[]>(() =>
    proNavGroups
      .filter(group => !group.pinned && !group.footer)
      .map(group => ({ ...group, links: linksByGroup.value.get(group.id) ?? [] }))
      .filter(section => section.links.length > 0))

  const footerLinks = computed<ProSiteNavLink[]>(() => {
    if (!toValue(siteId))
      return []
    const out: ProSiteNavLink[] = []
    for (const group of proNavGroups) {
      if (group.footer)
        out.push(...(linksByGroup.value.get(group.id) ?? []))
    }
    return out
  })

  return { pinnedLinks, sections, footerLinks }
}
