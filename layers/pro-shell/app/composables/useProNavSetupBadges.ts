// Sidebar setup chips, shared by every renderer of the Site nav so two
// renderings of the same state cannot drift.
//
// nuxtseo.com derives a chip per concern from its analytics, DataForSEO and
// assessment modules. None of those exist here, and importing them is what a
// port would get wrong, so the signals they feed are stubbed to `null` and
// named below. This app has two setup signals: whether the account has
// connected Google Search Console, and whether any Integration is pending.

import type { SiteFleetRow } from '~~/layers/core/app/types/data'
import type { UiNavSetup } from '#layers/design-system/app/shared/nav'
import type { ProSiteNavLink } from './useProSiteNav'
import { computed } from 'vue'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import { projectGscIntegrationState } from '#layers/pro-gsc/shared/gsc-integration-state'
import { integrationsNavSetup, pendingIntegrations } from '../utils/integrations-pending'

export interface ProNavSetupChip {
  /** One short imperative word. Anything longer is a layout bug. */
  verb: string
  tooltip: string
  tone?: 'primary' | 'warning'
}

export interface ProNavSetupBadges {
  /** Search Console is not connected for this account. */
  gscSetup: ProNavSetupChip | null
}

export function useProNavSetupBadges() {
  const { session } = useUserSession()
  const gscConnected = computed(() => !!(session.value as { gscConnected?: boolean } | undefined)?.gscConnected)

  const gscSetup = computed<ProNavSetupChip | null>(() => gscConnected.value
    ? null
    : {
        verb: 'Connect',
        tooltip: 'Connect Google Search Console to load this Site\'s search data',
      })

  // Stubs. nuxtseo.com resolves these from modules this app does not carry:
  // `web-analytics` (pro-analytics), `mentions` (pro-dataforseo) and the open
  // action count (pro-actions). Declared so the decorator below keeps the same
  // shape as upstream, and so adding one later is a single edit here.
  const analyticsSetup = computed<ProNavSetupChip | null>(() => null)
  const mentionsSetup = computed<ProNavSetupChip | null>(() => null)
  const openActionBadge = computed<string | undefined>(() => undefined)

  // Integrations still owed a connect step, from the same projections the
  // Integrations page renders, so the rail entry cannot disagree with the
  // rows. Search Console reads only the session here: the reconnect state
  // comes from gscdump's account status, which the session already carries.
  const gscIntegration = computed(() => projectGscIntegrationState({
    sessionConnected: gscConnected.value,
    accountStatus: session.value?.gscdumpAccountStatus ?? null,
    queryStatus: 'idle',
  }))
  // The dashboard layout owns the Site roster (`fetchSites`, key `sites`).
  // Reading its cached payload here costs no request of its own.
  const { data: roster } = useNuxtData<{ sites: SiteFleetRow[] }>('sites')
  const bing = useProBingIntegration(() => roster.value?.sites ?? [])
  const integrationsSetup = computed<UiNavSetup | null>(() => integrationsNavSetup(pendingIntegrations({
    gsc: gscIntegration.value,
    bing: bing.state.value,
  })))

  return { gscConnected, gscSetup, analyticsSetup, mentionsSetup, openActionBadge, integrationsSetup }
}

/**
 * Hangs the resolved chips on the rows that own them. The Search Console chip
 * lands on the Search Performance Overview row, which is where the reader goes
 * to connect.
 */
export function decorateSiteNavLink(
  link: ProSiteNavLink,
  badges: { gscSetup?: ProNavSetupChip | null },
): ProSiteNavLink {
  if (link.id === 'search-console' && badges.gscSetup)
    return { ...link, setup: badges.gscSetup, pending: false, pendingTooltip: undefined }
  return link
}
