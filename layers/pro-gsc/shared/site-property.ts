// Which Search Console property a Site reads from, decided before the Site
// exists.
//
// The connect route used to write the Site row first and leave the property to
// a listener. An address with no property still read "Connected", the wizard
// said "First sync started", and gscdump never heard of the Site. Every Site
// now needs a verified property in the caller's own Google account, read from
// gscdump, before the row is written.
//
// gscdump refuses the same registration on its side (`NO_MATCHING_GSC_PROPERTY`
// in gscdump.com `server/utils/site-registration.ts`). This check exists so the
// refusal reaches the person in this app's words, and so no local row is left
// behind for a Site the engine will never read.
//
// The strings below are canonical in COPY.md ("Connect a Site assets").

import type { GscdumpAvailableSite } from '@gscdump/contracts'
import { isVerifiedGscPermission, pickBestGscProperty } from 'gscdump'

/** One read of the Search Console properties gscdump holds for the caller. */
export type SearchConsolePropertyRead
  = | { _tag: 'NotConnected' }
    | { _tag: 'Unavailable', reason: string }
    | { _tag: 'Loaded', properties: readonly GscdumpAvailableSite[] }

export type SitePropertyRefusalReason
  = | 'not_connected'
    | 'no_properties'
    | 'not_owned'
    | 'unverified'
    | 'unavailable'

export interface SitePropertyRefusal {
  reason: SitePropertyRefusalReason
  message: string
}

export type SitePropertyMatch
  = | { _tag: 'Matched', property: GscdumpAvailableSite }
    | { _tag: 'Refused', refusal: SitePropertyRefusal }

/** A Site address after `parseSiteUrlInput`. */
export interface SiteAddress {
  origin: string
  domain: string
}

/**
 * A refusal a fresh read of Google can change. gscdump answers from a stored
 * copy of the Google list, so a property verified a moment ago is missing from
 * it. An empty list is always read live, so `no_properties` is not here.
 */
export function isStalePropertyRefusal(reason: SitePropertyRefusalReason): boolean {
  return reason === 'not_owned' || reason === 'unverified'
}

export function sitePropertyRefusalMessage(reason: SitePropertyRefusalReason, domain: string): string {
  switch (reason) {
    case 'not_connected':
      return 'Connect Google Search Console before you connect a Site. Request Indexing reads each Site from its Search Console property.'
    case 'no_properties':
      return `This Google account has no Search Console property, so ${domain} is not connected. Add the site in Search Console, or connect a different Google account.`
    case 'not_owned':
      return `No Search Console property in this Google account covers ${domain}. Add and verify it, or connect the Google account that owns it.`
    case 'unverified':
      return `The Search Console property for ${domain} is not verified for this Google account. Verify it, then try again.`
    case 'unavailable':
      return `Request Indexing could not read your Search Console properties, so ${domain} is not connected. Try again in a minute.`
  }
}

function refuse(reason: SitePropertyRefusalReason, address: SiteAddress): SitePropertyMatch {
  return { _tag: 'Refused', refusal: { reason, message: sitePropertyRefusalMessage(reason, address.domain) } }
}

/**
 * The verified property a Site reads from, or why there is none. Ranking is
 * gscdump's `pickBestGscProperty`, the rule the link step and gscdump's own
 * registration apply: a verified Domain property first, then a verified
 * URL-prefix property.
 */
export function matchSiteProperty(address: SiteAddress, read: SearchConsolePropertyRead): SitePropertyMatch {
  switch (read._tag) {
    case 'NotConnected':
      return refuse('not_connected', address)
    case 'Unavailable':
      return refuse('unavailable', address)
    case 'Loaded': {
      if (!read.properties.length)
        return refuse('no_properties', address)
      const best = pickBestGscProperty(address.origin, read.properties)
      if (!best)
        return refuse('not_owned', address)
      if (!isVerifiedGscPermission(best.permissionLevel))
        return refuse('unverified', address)
      return { _tag: 'Matched', property: best }
    }
  }
}
