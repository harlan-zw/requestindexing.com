// Add and verify a Search Console property, the shapes both sides share.
//
// Ported from nuxtseo.com ADR-0074 (`ProGscAddVerify.vue` and the
// `gsc-verification-token` / `gsc-add-and-verify` routes). gscdump does the
// work through `partner.users.verification.token.create` and
// `partner.users.sites.verify.create`. This app parses the address, keeps the
// pending record, and says what happened.
//
// Every answer is a tagged value. A record Google cannot see yet is the normal
// path of this flow, so it is never an HTTP error.

import { GSC_SITE_VERIFICATION_SCOPE, GSC_WRITE_SCOPE } from 'gscdump/client'
import { parseSiteUrlInput } from '#layers/pro-saas/shared/site-url'
import { ADD_VERIFY_REFUSED } from './add-verify-copy'

/**
 * The methods this app offers, DNS first. A DNS record verifies a Domain
 * property, which covers every subdomain. A meta tag verifies one URL prefix.
 */
export const VERIFICATION_METHODS = ['DNS_TXT', 'META'] as const
export type VerificationMethod = typeof VERIFICATION_METHODS[number]

/** The property the reader asked to add, and how they prove ownership. */
export interface VerificationTarget {
  /** The bare host, as the Site list and the property list key it. */
  domain: string
  /** The property gscdump adds: `sc-domain:` for a DNS record, a URL prefix for a meta tag. */
  siteUrl: string
  method: VerificationMethod
}

export type VerificationTargetParse
  = | { _tag: 'Ok', target: VerificationTarget }
    | { _tag: 'Err', message: string }

/**
 * Parse the address a reader typed into the property gscdump adds.
 *
 * A DNS record proves the whole domain, so it adds `sc-domain:` on the bare
 * host. A meta tag proves one page, so it keeps the host as typed, `www.`
 * included: Google reads the tag from that exact address. nuxtseo.com builds
 * the same `${protocol}//${host}/` candidate.
 */
export function parseVerificationTarget(raw: string, method: VerificationMethod): VerificationTargetParse {
  const parsed = parseSiteUrlInput(raw)
  if (parsed._tag === 'Err')
    return parsed
  if (parsed.domain === 'localhost')
    return { _tag: 'Err', message: ADD_VERIFY_REFUSED.localhost }

  if (method === 'DNS_TXT')
    return { _tag: 'Ok', target: { domain: parsed.domain, siteUrl: `sc-domain:${parsed.domain}`, method } }

  const origin = new URL(parsed.origin)
  const typedWww = /^(?:[a-z][\w+.-]*:\/\/)?www\./i.test(raw.trim())
  const host = typedWww ? `www.${origin.host}` : origin.host
  return { _tag: 'Ok', target: { domain: parsed.domain, siteUrl: `${origin.protocol}//${host}/`, method } }
}

/** What the reader places so Google can find it. */
export type VerificationRecord
  = | { _tag: 'DnsTxt', name: string, value: string }
    | { _tag: 'MetaTag', content: string, pageUrl: string }

/** A record minted and not verified yet. The reader can leave and come back to it. */
export interface PendingVerification extends VerificationTarget {
  record: VerificationRecord
  /** Checks that did not find the record since it was minted. */
  attempts: number
  mintedAt: string
}

/**
 * Whether the Google grant gscdump holds can add and verify a property.
 * `Unknown` when gscdump did not answer: the flow goes on, and a mint that
 * gscdump refuses for the scope still asks for the grant.
 */
export type VerifyGrant
  = | { _tag: 'Ready' }
    | { _tag: 'ScopeMissing' }
    | { _tag: 'Unknown' }

/**
 * gscdump needs `webmasters` to add the property and `siteverification` to
 * verify it (`missingVerificationScopes` in gscdump.com). The Search Console
 * connect asks for neither verify scope, so most grants answer `ScopeMissing`
 * until the reader starts this flow.
 */
export function resolveVerifyGrant(grantedScopes: readonly string[]): VerifyGrant {
  const granted = new Set(grantedScopes)
  return granted.has(GSC_WRITE_SCOPE) && granted.has(GSC_SITE_VERIFICATION_SCOPE)
    ? { _tag: 'Ready' }
    : { _tag: 'ScopeMissing' }
}

/** `GET /api/pro/gsc-verification`. */
export interface PropertyVerificationState {
  grant: VerifyGrant
  /** The caller's pending records, newest first. */
  pending: PendingVerification[]
}

export type VerificationRefusalReason
  = | 'invalid_address'
    | 'not_connected'
    /** The Site Verification API is off for the Cloud project of this app's OAuth client. */
    | 'api_disabled'
    | 'unavailable'

export interface VerificationRefusal {
  reason: VerificationRefusalReason
  message: string
}

/** `POST /api/pro/gsc-verification/record`. */
export type MintVerificationResult
  = | { _tag: 'Minted', verification: PendingVerification }
    | { _tag: 'ScopeMissing' }
    | { _tag: 'Refused', refusal: VerificationRefusal }

/** `POST /api/pro/gsc-verification/verify`. */
export type CheckVerificationResult
  = | { _tag: 'Verified', domain: string, siteUrl: string }
    /** Google did not find the record. The pending record stays for the next check. */
    | { _tag: 'NotLive', message: string }
    | { _tag: 'ScopeMissing' }
    | { _tag: 'Refused', refusal: VerificationRefusal }

/** The body both POST routes take. */
export interface VerificationRequest {
  address: string
  method: VerificationMethod
}

/** The marker the Google grant brings back on `returnTo`, as nuxtseo.com does. */
export const VERIFY_GRANT_RETURN_QUERY = 'gsc_scope_granted'
export const VERIFY_GRANT_RETURN_VALUE = 'verify'
