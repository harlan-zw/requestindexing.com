// The Free allowance as this app reads it. gscdump sets the numbers and
// enforces them (gscdump.com ADR-0014). This module turns an entitlements read
// into what the connect flow and the Usage page need. It keeps no number of
// its own, so a gscdump change to the allowance needs no change here.
//
// Pure: no Nuxt, no fetch. The server reads entitlements; this decides.
import type { EntitlementRefusal } from '@gscdump/contracts'
import type { PartnerUserEntitlementsV1 } from '@gscdump/contracts/v1'

export type MeteredEntitlements = Extract<PartnerUserEntitlementsV1, { mode: 'metered' }>

/**
 * The outcome of an optional `partner.users.entitlements.get` read.
 *
 * `Skipped` means the caller has no gscdump account yet, so gscdump knows no
 * Site of theirs. `Unavailable` means the read failed.
 */
export type EntitlementsRead
  = | { _tag: 'Skipped' }
    | { _tag: 'Loaded', entitlements: PartnerUserEntitlementsV1 }
    | { _tag: 'Unavailable', reason: string }

/** How many Sites the caller may connect. */
export type SiteAllowance
  = | { _tag: 'Uncapped' }
    | { _tag: 'Capped', used: number, allowance: number }
    | { _tag: 'Unknown' }

export function siteAllowanceOf(read: EntitlementsRead): SiteAllowance {
  if (read._tag !== 'Loaded')
    return { _tag: 'Unknown' }
  if (read.entitlements.mode === 'exempt')
    return { _tag: 'Uncapped' }
  const { used, allowance } = read.entitlements.meters.sites
  return { _tag: 'Capped', used, allowance }
}

export type SiteAllowanceRefusal = Extract<EntitlementRefusal, { reason: 'site_allowance' }>

export type SiteConnectDecision
  = | { _tag: 'Allow' }
    | { _tag: 'Refuse', refusal: SiteAllowanceRefusal }

/**
 * Whether one more Site fits the Free allowance.
 *
 * Only a known, full allowance refuses. gscdump refuses again when the Site
 * registers, so an unknown allowance never blocks: this check saves a local
 * row that could never link, it is not the enforcement.
 */
export function decideSiteConnect(allowance: SiteAllowance): SiteConnectDecision {
  if (allowance._tag === 'Capped' && allowance.used >= allowance.allowance)
    return { _tag: 'Refuse', refusal: { reason: 'site_allowance', limit: allowance.allowance } }
  return { _tag: 'Allow' }
}

/**
 * What the Usage page shows about the Free allowance.
 *
 * `Hidden` covers an exempt partner and an account gscdump does not know yet:
 * neither has a Meter to show, so the page renders as it did before metering.
 */
export type FreeAllowanceView
  = | { _tag: 'Hidden' }
    | { _tag: 'Unavailable' }
    | { _tag: 'Metered', entitlements: MeteredEntitlements }

export function freeAllowanceView(read: EntitlementsRead): FreeAllowanceView {
  switch (read._tag) {
    case 'Skipped':
      return { _tag: 'Hidden' }
    case 'Unavailable':
      return { _tag: 'Unavailable' }
    case 'Loaded':
      return read.entitlements.mode === 'exempt'
        ? { _tag: 'Hidden' }
        : { _tag: 'Metered', entitlements: read.entitlements }
  }
}
