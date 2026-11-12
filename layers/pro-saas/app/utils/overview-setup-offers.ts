// The Setup completion of the Bing and Add another Site offers on the
// dashboard home, from the reads this app already makes. Pure, so the rule is
// tested without a Nuxt app. The agent offers read `developerSetupCompletion`.
import type { SetupCompletion } from '@nuxtseo/pro-shell/shared/setup-offers'
import type { BingIntegrationState } from '#layers/pro-gsc/app/utils/bing-integration-view'
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { SETUP_COMPLETE, SETUP_PENDING, SETUP_RECONNECT, SETUP_UNAVAILABLE, SETUP_UNKNOWN } from '@nuxtseo/pro-shell/shared/setup-offers'

/**
 * Bing, from the Integrations row's state. `connect` is owed only while no
 * Site is linked, and a connection Bing stopped accepting asks to reconnect.
 * A flag that is off, an account gscdump does not offer Bing to, and a failed
 * read all show no card.
 */
export function bingSetupCompletion(state: BingIntegrationState): SetupCompletion {
  switch (state._tag) {
    case 'checking':
      return SETUP_UNKNOWN
    case 'unavailable':
    case 'not-offered':
    case 'read-failed':
      return SETUP_UNAVAILABLE
    case 'ready':
      if (state.summary.pending === 'reconnect')
        return SETUP_RECONNECT
      return state.summary.pending === 'connect' ? SETUP_PENDING : SETUP_COMPLETE
  }
}

/**
 * Add another Site, from the Site count and the Free allowance gscdump
 * reports. With no Site, the setup card offers the first one instead. A full
 * allowance has no room for another. An account with no meter has no cap.
 * An unread allowance waits.
 */
export function anotherSiteCompletion(input: { siteCount: number, allowance: FreeAllowanceView | null }): SetupCompletion {
  if (input.siteCount === 0)
    return SETUP_UNAVAILABLE
  const allowance = input.allowance
  if (!allowance || allowance._tag === 'Unavailable')
    return SETUP_UNKNOWN
  if (allowance._tag === 'Hidden')
    return SETUP_PENDING
  const { used, allowance: limit } = allowance.entitlements.meters.sites
  return used < limit ? SETUP_PENDING : SETUP_COMPLETE
}
