// Nav model for one Site in scope. Ported from nuxtseo.com's
// `apps/pro/app/composables/useProSingleSiteNav.ts`, minus the workspace rail
// (no Reports, no Alerts, no Chat, no inactive Sites) and the monitoring tier.
//
// The owning renderer supplies the Site explicitly rather than reading it back
// from the route, so the fleet shell and the per-site shell render the SAME
// sidebar and it never flips when the reader crosses between them.

import type { MaybeRefOrGetter } from 'vue'
import type { ProNavSection, ProSiteNavFlags, ProSiteNavLink } from './useProSiteNav'
import { computed, toValue } from 'vue'
import { readProFeatureFlags } from '../../shared/manifest'
import { decorateSiteNavLink, useProNavSetupBadges } from './useProNavSetupBadges'
import { useProSiteNav } from './useProSiteNav'

/**
 * The Site fields the sidebar reads. Both `/api/sites/list` rows and
 *  `/api/pro/sites/:id` satisfy it.
 */
export interface ProNavSite {
  id?: string
  publicId?: string
  /** `/api/sites/list` names the public id `siteId`. */
  siteId?: string
  url?: string | null
  name?: string | null
  domain?: string | null
  property?: string | null
  /** `/api/sites/list` carries gscdump's hold reason for a held Site. */
  hold?: string | null
}

function hostnameOf(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
  }
  catch {
    return value
  }
}

export function useProSingleSiteNav(siteSource: MaybeRefOrGetter<ProNavSite | null | undefined>) {
  const site = computed(() => toValue(siteSource) ?? null)
  // Nav routes by the short public id (`s_…`), matching the fleet site links.
  const siteRef = computed(() => site.value?.publicId ?? site.value?.siteId ?? site.value?.id ?? '')
  const siteTo = computed(() => siteRef.value ? `/pro/dashboard/sites/${siteRef.value}` : '/pro/dashboard')
  const siteDomain = computed(() => {
    const raw = site.value?.domain || site.value?.url || site.value?.property || ''
    return raw ? hostnameOf(raw) : ''
  })
  const siteLabel = computed(() => site.value?.name || siteDomain.value || 'Site')

  const { gscConnected, gscSetup } = useProNavSetupBadges()

  // The favicon plus site-name header row replaces the synthesized Overview
  // link, exactly as upstream does.
  // One place decides what a flag means. `useProSiteNav` stays free of runtime
  // config so it can be exercised without a Nuxt instance.
  const flags = computed<ProSiteNavFlags>(() => readProFeatureFlags(useRuntimeConfig().public))

  const { pinnedLinks, sections, footerLinks } = useProSiteNav(() => siteRef.value, {
    flags,
    overviewLink: false,
    // Integration readiness is the only gate left. An unconnected account still
    // sees every row; the waiting dot says the data is not there yet.
    pending: integration => (integration === 'gsc-connected' && !gscConnected.value)
      ? { tooltip: 'Waiting for Google Search Console' }
      : null,
  })

  const decorate = (link: ProSiteNavLink) => decorateSiteNavLink(link, { gscSetup: gscSetup.value })

  const decoratedPinnedLinks = computed<ProSiteNavLink[]>(() => pinnedLinks.value.map(decorate))
  const decoratedSections = computed<ProNavSection[]>(() =>
    sections.value.map(section => ({ ...section, links: section.links.map(decorate) })))
  const railLinks = computed<ProSiteNavLink[]>(() => footerLinks.value.map(decorate))

  return {
    site,
    siteRef,
    siteTo,
    siteDomain,
    siteLabel,
    pinnedLinks: decoratedPinnedLinks,
    sections: decoratedSections,
    railLinks,
  }
}
