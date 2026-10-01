// The Search Console property list on Connect a Site, as one tagged state.
//
// Ported from nuxtseo.com `apps/pro/app/components/pro/ProSiteAddForm.vue`
// (the `gsc` entry mode): loading, provisioning, reconnect, a failed read, no
// properties, every property already added, and the list. Upstream keeps the
// branches inline in the template; here they are a pure function, so the
// wizard's skip and the template read one answer.

import { isVerifiedGscPermission } from 'gscdump'
import { parseSiteUrlInput } from '#layers/pro-saas/shared/site-url'

type QueryStatus = 'idle' | 'pending' | 'success' | 'error'

/** The fields of `/api/pro/gsc-properties` the picker reads. */
export interface PropertyPickerResponse {
  connected: boolean
  properties: ReadonlyArray<{ siteUrl: string, permissionLevel: string }>
  error?: { reason: string, message: string }
}

export interface PickerProperty {
  siteUrl: string
  domain: string
  /** Google lists the property for this account but has not verified it. */
  verified: boolean
}

export type PropertyPickerState
  = | { _tag: 'Loading' }
    /** No gscdump connection: there is no list to read. */
    | { _tag: 'NotConnected' }
    | { _tag: 'Provisioning', message: string }
    /** The grant is dead or lacks Search Console. Only a new Google grant clears it. */
    | { _tag: 'Reconnect', message: string }
    | { _tag: 'Failed', message: string }
    /** The Google account holds no Search Console property at all. */
    | { _tag: 'NoProperties' }
    /** Every property is already a Site of this Team. */
    | { _tag: 'AllConnected' }
    | { _tag: 'Properties', properties: PickerProperty[] }

export interface PropertyPickerInput {
  /** The property read. A re-read keeps `data` at the last answer until it lands. */
  queryStatus: QueryStatus
  data: PropertyPickerResponse | null | undefined
  /** The Team's Sites answered at least once. */
  sitesLoaded: boolean
  /** The bare hosts of the Team's connected Sites. */
  connectedDomains: ReadonlySet<string>
}

const READ_FAILED = 'Request Indexing could not read your Search Console properties. Try again.'

// The reason codes `/api/pro/gsc-properties` answers with. The same four ask
// for a reconnect on nuxtseo.com.
const RECONNECT_REASONS: ReadonlySet<string> = new Set([
  'MISSING_REFRESH_TOKEN',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
  'AUTH_EXPIRED',
  'GSCDUMP_NOT_CONNECTED',
])

// Google can list one site as a Domain property and as URL-prefix properties.
// Two rows with one label make the choice impossible to read, so one row per
// host, the Domain property first, as on nuxtseo.com.
function rank(siteUrl: string): number {
  if (siteUrl.startsWith('sc-domain:'))
    return 0
  return siteUrl.startsWith('https://') ? 1 : 2
}

function pickerProperties(response: PropertyPickerResponse, connectedDomains: ReadonlySet<string>): PickerProperty[] {
  const byDomain = new Map<string, PickerProperty>()
  for (const property of response.properties) {
    const parsed = parseSiteUrlInput(property.siteUrl)
    if (parsed._tag === 'Err' || connectedDomains.has(parsed.domain))
      continue
    const candidate = { siteUrl: property.siteUrl, domain: parsed.domain, verified: isVerifiedGscPermission(property.permissionLevel) }
    const current = byDomain.get(parsed.domain)
    // A verified row beats an unverified one, then the wider property wins.
    if (!current
      || (candidate.verified && !current.verified)
      || (candidate.verified === current.verified && rank(candidate.siteUrl) < rank(current.siteUrl))) {
      byDomain.set(parsed.domain, candidate)
    }
  }
  return [...byDomain.values()].sort((a, b) => Number(b.verified) - Number(a.verified) || a.domain.localeCompare(b.domain))
}

export function projectPropertyPicker(input: PropertyPickerInput): PropertyPickerState {
  if (input.queryStatus === 'error')
    return { _tag: 'Failed', message: READ_FAILED }
  // Only the first read shows Loading. Refresh, a connect, and the realtime
  // resync each re-read the list, and the answer stays on screen until the new
  // one lands. Before this, the resync about 3 s after load put the list back
  // to Loading for a second full read. Until the Team's Sites answer, a
  // connected property would show as connectable, so the list waits for them.
  const data = input.data
  if (!data || !input.sitesLoaded)
    return { _tag: 'Loading' }
  if (!data.connected)
    return { _tag: 'NotConnected' }
  if (data.error) {
    if (data.error.reason === 'USER_PROVISIONING')
      return { _tag: 'Provisioning', message: data.error.message }
    if (RECONNECT_REASONS.has(data.error.reason))
      return { _tag: 'Reconnect', message: data.error.message }
    return { _tag: 'Failed', message: data.error.message || READ_FAILED }
  }
  if (!data.properties.length)
    return { _tag: 'NoProperties' }
  const properties = pickerProperties(data, input.connectedDomains)
  return properties.length ? { _tag: 'Properties', properties } : { _tag: 'AllConnected' }
}

/**
 * Whether the picker leaves nothing to connect right now. The wizard offers
 * "Skip and connect it later" on this, the way nuxtseo.com reveals its skip
 * after a Site fails. A list still loading blocks nothing.
 */
export function propertyPickerBlocksConnect(state: PropertyPickerState): boolean {
  if (state._tag === 'Loading')
    return false
  if (state._tag === 'Properties')
    return !state.properties.some(property => property.verified)
  return true
}
