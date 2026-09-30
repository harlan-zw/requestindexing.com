// The pending Integrations rail entry. Ported from nuxtseo.com
// `apps/pro/app/utils/integrations-pending.ts`, plus the rule that decides
// what is pending, which upstream keeps inline in its nav composable. Here it
// is a pure function of the same two row states the Integrations page renders,
// so the rail entry and the page cannot disagree.
import type { UiNavLink, UiNavSetup } from '#layers/design-system/app/shared/nav'
import type { BingIntegrationState } from '#layers/pro-gsc/app/utils/bing-view'
import type { GscIntegrationState } from '#layers/pro-gsc/shared/gsc-integration-state'

export const INTEGRATIONS_ROUTE = '/pro/dashboard/integrations'

/**
 * One Integration the account still owes a connect step. Only Integrations
 * whose absence stops data collection count here.
 */
export interface PendingIntegration {
  name: string
  /** `reconnect`: the service stopped accepting the stored connection. */
  kind: 'connect' | 'reconnect'
}

export function pendingIntegrations(states: { gsc: GscIntegrationState, bing: BingIntegrationState }): PendingIntegration[] {
  const pending: PendingIntegration[] = []
  if (states.gsc._tag === 'reconnect-required')
    pending.push({ name: 'Search Console', kind: 'reconnect' })
  else if (states.gsc._tag === 'disconnected')
    pending.push({ name: 'Search Console', kind: 'connect' })
  // Bing is optional, so only a connection Bing stopped accepting counts: that
  // stops data already arriving. A Site that never connected Bing owes nothing.
  if (states.bing._tag === 'ready' && states.bing.reconnect > 0)
    pending.push({ name: 'Bing', kind: 'reconnect' })
  return pending
}

/** The rail entry's chip, or null when nothing is left to connect. */
export function integrationsNavSetup(pending: readonly PendingIntegration[]): UiNavSetup | null {
  if (!pending.length)
    return null
  const reconnect = pending.some(integration => integration.kind === 'reconnect')
  const states = pending.map(integration => integration.kind === 'reconnect'
    ? `${integration.name} needs reconnecting`
    : `${integration.name} not connected`)
  return {
    verb: reconnect ? 'Reconnect' : 'Connect',
    tooltip: `${states.join(' · ')} · Open Integrations`,
    tone: reconnect ? 'warning' : 'primary',
  }
}

/**
 * The bottom-rail Integrations entry. It shows only while an Integration is
 * pending: once everything is connected the page stays one click away in the
 * user menu, and a permanent rail row would be chrome with nothing to say.
 */
export function integrationsRailLinks(setup: UiNavSetup | null): UiNavLink[] {
  if (!setup)
    return []
  return [{
    label: 'Integrations',
    icon: 'plug',
    to: INTEGRATIONS_ROUTE,
    active: (path: string) => path.startsWith(INTEGRATIONS_ROUTE),
    setup,
  }]
}
