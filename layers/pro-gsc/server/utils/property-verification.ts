// Add and verify a Search Console property: the server half.
//
// Ported from nuxtseo.com ADR-0074: `server/api/pro/gsc-verification-token.post.ts`,
// `server/api/pro/gsc-add-and-verify.post.ts`, and the `fetchGscVerificationToken`
// / `gscAddAndVerify` helpers in `server/utils/gscdump-origin.ts`. gscdump owns
// the capability (`partner.users.verification.token.create` and
// `partner.users.sites.verify.create`) and holds the Google grant. Both
// operations take the partner key, so they run here and never through the
// browser proxy, as on nuxtseo.com.
//
// What this app keeps is the pending record, so a reader who leaves to edit DNS
// can come back to the same record. nuxtseo.com keeps it on its `sites` row;
// here no Site exists before the property is verified, so the record is the
// user's, one per domain.

import type { GscdumpV1Client } from '@gscdump/sdk/v1'
import type { GscPropertyVerification } from '~~/layers/core/server/db/schema'
import type {
  CheckVerificationResult,
  MintVerificationResult,
  PendingVerification,
  PropertyVerificationState,
  VerificationMethod,
  VerificationRecord,
  VerificationRefusal,
  VerificationRefusalReason,
  VerificationRequest,
  VerificationTarget,
  VerifyGrant,
} from '../../shared/property-verification'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { and, desc, eq, sql } from 'drizzle-orm'
import { gscPropertyVerifications } from '#layers/pro-saas/server/database'
import { ADD_VERIFY_REFUSED, notLiveDnsMessage, notLiveMetaMessage, verifyFailedMessage } from '../../shared/add-verify-copy'
import { parseVerificationTarget, resolveVerifyGrant } from '../../shared/property-verification'

/** The fields of gscdump's verification token this app reads. */
export interface GscdumpVerificationToken {
  /** Google's verification target: the bare domain for DNS, the URL prefix for a meta tag. */
  site: { identifier: string }
  metaContent: string | null
  dnsRecord: { type: 'TXT' | 'CNAME', host: string, value: string } | null
}

interface VerificationBody {
  siteUrl: string
  method: VerificationMethod
}

/** The gscdump operations Add and verify needs. */
export interface VerificationEngine {
  /** The scopes of the Google grant gscdump holds, from the user lifecycle. */
  readGrantedScopes: (gscdumpUserId: string) => Promise<readonly string[]>
  createVerificationToken: (gscdumpUserId: string, body: VerificationBody) => Promise<GscdumpVerificationToken>
  /** Add the property, then ask Google to verify it. A failed check leaves the property added and unverified. */
  addAndVerifySite: (gscdumpUserId: string, body: VerificationBody) => Promise<unknown>
  /** Read Google's property list live, so gscdump's stored copy holds the new property. */
  refreshProperties: (gscdumpUserId: string) => Promise<unknown>
}

/** The three verification operations on a v1 client. The lifecycle read comes from the caller. */
export function gscdumpVerificationEngine(client: GscdumpV1Client, options: { timeoutMs: number }): Omit<VerificationEngine, 'readGrantedScopes'> {
  // A fresh signal per call, so a spent deadline never carries into the next call.
  const deadline = () => ({ signal: AbortSignal.timeout(options.timeoutMs) })
  return {
    createVerificationToken: (userId, body) =>
      client.createVerificationToken({ params: { userId }, body }, deadline()).then(response => response.data),
    addAndVerifySite: (userId, body) =>
      client.addAndVerifySite({ params: { userId }, body }, deadline()).then(response => response.data),
    refreshProperties: userId =>
      client.listAvailableSites({ params: { userId }, query: { refresh: true } }, deadline()).then(response => response.data),
  }
}

export interface VerificationCaller {
  /** The local user, who owns the pending record. */
  userId: number
  /** The gscdump user that holds the Google grant. Null when Search Console is not connected. */
  gscdumpUserId: string | null
}

export interface VerificationDeps {
  db: ReturnType<typeof useDrizzle>
  engine: VerificationEngine
  now: () => Date
  warn: (message: string, detail: Record<string, unknown>) => void
}

type VerificationFailure = 'scope_missing' | 'not_live' | 'api_disabled' | 'unavailable'

// Google's reasons when the Site Verification API is off for the Cloud project
// of the OAuth client. gscdump.com names its own `SITE_VERIFICATION_API_DISABLED`
// on a mint, and passes Google's reason through on a check.
const API_DISABLED_REASONS: ReadonlySet<unknown> = new Set(['SITE_VERIFICATION_API_DISABLED', 'SERVICE_DISABLED', 'accessNotConfigured'])

/**
 * Read a gscdump refusal once, at the boundary. Anything that is not a gscdump
 * v1 error is a defect here, so it propagates.
 *
 * On a check, gscdump.com answers Google's "token not found" (a 403 from Google)
 * as 422, which its v1 boundary sends as 409 `invalid_request`. Google can also
 * answer a missing token with 400, which gscdump passes on as 400
 * `invalid_request`. Both mean the record is not live yet. The request body was
 * parsed before the call, so no other 400 is expected here.
 */
export function classifyVerificationFailure(stage: 'record' | 'verify', error: unknown): VerificationFailure {
  if (!isGscdumpV1Error(error))
    throw error
  const reason = error.details.reason
  if (reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    return 'scope_missing'
  if (API_DISABLED_REASONS.has(reason))
    return 'api_disabled'
  if (stage === 'verify' && error.code === 'invalid_request' && (error.status === 409 || error.status === 400))
    return 'not_live'
  return 'unavailable'
}

function refused(reason: VerificationRefusalReason, message: string): { _tag: 'Refused', refusal: VerificationRefusal } {
  return { _tag: 'Refused', refusal: { reason, message } }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function recordOf(target: VerificationTarget, token: GscdumpVerificationToken): VerificationRecord | null {
  if (target.method === 'DNS_TXT') {
    return token.dnsRecord?.type === 'TXT'
      ? { _tag: 'DnsTxt', name: token.dnsRecord.host, value: token.dnsRecord.value }
      : null
  }
  return token.metaContent
    ? { _tag: 'MetaTag', content: token.metaContent, pageUrl: token.site.identifier }
    : null
}

function pendingOf(row: GscPropertyVerification): PendingVerification {
  const record: VerificationRecord = row.method === 'DNS_TXT'
    ? { _tag: 'DnsTxt', name: row.target, value: row.token }
    : { _tag: 'MetaTag', content: row.token, pageUrl: row.target }
  return {
    domain: row.domain,
    siteUrl: row.siteUrl,
    method: row.method,
    record,
    attempts: row.attempts,
    mintedAt: row.mintedAt.toISOString(),
  }
}

/** Whether the caller's grant can add and verify, and the records they left pending. */
export async function readPropertyVerificationState(deps: VerificationDeps, caller: VerificationCaller): Promise<PropertyVerificationState> {
  const readGrant = async (): Promise<VerifyGrant> => {
    // No gscdump user means no grant. Grant permission runs the Search Console
    // connect, which also creates the gscdump user.
    if (!caller.gscdumpUserId)
      return { _tag: 'ScopeMissing' }
    const gscdumpUserId = caller.gscdumpUserId
    return deps.engine.readGrantedScopes(gscdumpUserId)
      .then(resolveVerifyGrant)
      .catch((error: unknown): VerifyGrant => {
        // The flow goes on: a mint that gscdump refuses for the scope still
        // asks for the permission.
        deps.warn('[gsc-verification] grant not read', { gscdumpUserId, error: errorText(error) })
        return { _tag: 'Unknown' }
      })
  }

  const [grant, rows] = await Promise.all([
    readGrant(),
    deps.db.select()
      .from(gscPropertyVerifications)
      .where(eq(gscPropertyVerifications.userId, caller.userId))
      .orderBy(desc(gscPropertyVerifications.mintedAt)),
  ])
  return { grant, pending: rows.map(pendingOf) }
}

/**
 * Get the record the reader places on the site or in DNS, and keep it pending.
 * Google returns the same token for the same account, site, and method, so a
 * second mint gives the reader the record they already placed.
 */
export async function mintPropertyVerification(
  deps: VerificationDeps,
  caller: VerificationCaller,
  request: VerificationRequest,
): Promise<MintVerificationResult> {
  const parsed = parseVerificationTarget(request.address, request.method)
  if (parsed._tag === 'Err')
    return refused('invalid_address', parsed.message)
  if (!caller.gscdumpUserId)
    return refused('not_connected', ADD_VERIFY_REFUSED.notConnected)
  const target = parsed.target
  const gscdumpUserId = caller.gscdumpUserId

  const minted = await deps.engine.createVerificationToken(gscdumpUserId, { siteUrl: target.siteUrl, method: target.method })
    .then(token => ({ _tag: 'Ok' as const, token }))
    .catch((error: unknown) => ({ _tag: 'Failed' as const, failure: classifyVerificationFailure('record', error), detail: errorText(error) }))

  if (minted._tag === 'Failed') {
    switch (minted.failure) {
      case 'scope_missing':
        return { _tag: 'ScopeMissing' }
      case 'api_disabled':
        deps.warn('[gsc-verification] Site Verification API is off', { gscdumpUserId, error: minted.detail })
        return refused('api_disabled', ADD_VERIFY_REFUSED.apiDisabled)
      case 'not_live':
      case 'unavailable':
        deps.warn('[gsc-verification] record not minted', { gscdumpUserId, siteUrl: target.siteUrl, error: minted.detail })
        return refused('unavailable', ADD_VERIFY_REFUSED.record)
    }
  }

  const record = recordOf(target, minted.token)
  if (!record) {
    deps.warn('[gsc-verification] gscdump answered without a record', { gscdumpUserId, siteUrl: target.siteUrl, method: target.method })
    return refused('unavailable', ADD_VERIFY_REFUSED.record)
  }

  const values = {
    siteUrl: target.siteUrl,
    method: target.method,
    target: record._tag === 'DnsTxt' ? record.name : record.pageUrl,
    token: record._tag === 'DnsTxt' ? record.value : record.content,
    attempts: 0,
    lastError: null,
    mintedAt: deps.now(),
    checkedAt: null,
  }
  // A second mint for the domain replaces the first, as nuxtseo.com resets its
  // record: switching method gives a different record.
  const [row] = await deps.db.insert(gscPropertyVerifications)
    .values({ userId: caller.userId, domain: target.domain, ...values })
    .onConflictDoUpdate({ target: [gscPropertyVerifications.userId, gscPropertyVerifications.domain], set: values })
    .returning()
  if (!row)
    throw new Error('gsc_property_verifications upsert returned no row')
  return { _tag: 'Minted', verification: pendingOf(row) }
}

/**
 * Add the property and ask Google to verify it. When Google finds the record,
 * the pending record goes and gscdump reads the property list live, so every
 * list in this app shows the new property. Connecting it as a Site stays the
 * reader's step, through the ownership check on `POST /api/pro/sites`.
 */
export async function checkPropertyVerification(
  deps: VerificationDeps,
  caller: VerificationCaller,
  request: VerificationRequest,
): Promise<CheckVerificationResult> {
  const parsed = parseVerificationTarget(request.address, request.method)
  if (parsed._tag === 'Err')
    return refused('invalid_address', parsed.message)
  if (!caller.gscdumpUserId)
    return refused('not_connected', ADD_VERIFY_REFUSED.notConnected)
  const target = parsed.target
  const gscdumpUserId = caller.gscdumpUserId
  const pendingRow = and(
    eq(gscPropertyVerifications.userId, caller.userId),
    eq(gscPropertyVerifications.domain, target.domain),
    eq(gscPropertyVerifications.siteUrl, target.siteUrl),
  )

  const checked = await deps.engine.addAndVerifySite(gscdumpUserId, { siteUrl: target.siteUrl, method: target.method })
    .then(() => ({ _tag: 'Ok' as const }))
    .catch((error: unknown) => ({ _tag: 'Failed' as const, failure: classifyVerificationFailure('verify', error), detail: errorText(error) }))

  if (checked._tag === 'Ok') {
    await deps.db.delete(gscPropertyVerifications).where(pendingRow)
    await deps.engine.refreshProperties(gscdumpUserId).catch((error: unknown) => {
      // The property is verified either way. Refresh list reads Google live,
      // and the connect route reads it live before it refuses an address.
      deps.warn('[gsc-verification] property list not refreshed after verify', { gscdumpUserId, siteUrl: target.siteUrl, error: errorText(error) })
    })
    return { _tag: 'Verified', domain: target.domain, siteUrl: target.siteUrl }
  }

  const checkedAt = deps.now()
  switch (checked.failure) {
    case 'scope_missing':
      return { _tag: 'ScopeMissing' }
    case 'not_live':
      await deps.db.update(gscPropertyVerifications)
        .set({ attempts: sql`${gscPropertyVerifications.attempts} + 1`, lastError: checked.detail, checkedAt })
        .where(pendingRow)
      return {
        _tag: 'NotLive',
        message: target.method === 'DNS_TXT' ? notLiveDnsMessage(target.domain) : notLiveMetaMessage(target.siteUrl),
      }
    case 'api_disabled':
      deps.warn('[gsc-verification] Site Verification API is off', { gscdumpUserId, error: checked.detail })
      return refused('api_disabled', ADD_VERIFY_REFUSED.apiDisabled)
    case 'unavailable':
      deps.warn('[gsc-verification] check failed', { gscdumpUserId, siteUrl: target.siteUrl, error: checked.detail })
      await deps.db.update(gscPropertyVerifications)
        .set({ lastError: checked.detail, checkedAt })
        .where(pendingRow)
      return refused('unavailable', verifyFailedMessage(target.domain))
  }
}
