// Read a gscdump entitlement refusal out of whatever failure carried it.
//
// A refusal reaches this app in three shapes: a `GscdumpV1Error` from the SDK
// (server calls, and browser calls through the v1 proxy), an H3 error that
// `rethrowV1AsH3` built from one, and a `$fetch` failure from one of this
// app's own routes. Each keeps the v1 `details` at a different depth. This is
// the one place that knows the depths, so every call site parses the same way.
import type { EntitlementRefusal, IndexingInspectRateLimited } from '@gscdump/contracts'
import { parseEntitlementRefusal } from '@gscdump/contracts'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { refusalMessage } from './entitlement-copy'

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
}

function detailCandidates(error: unknown): unknown[] {
  if (isGscdumpV1Error(error))
    return [error.details]
  const data = field(error, 'data')
  return [
    // H3 error built by `rethrowV1AsH3`: `{ data: { details } }`.
    field(data, 'details'),
    // `$fetch` failure from an API route: the body is on `data`, the envelope on `data.data`.
    field(field(data, 'data'), 'details'),
  ]
}

export function refusalFromError(error: unknown): EntitlementRefusal | null {
  for (const details of detailCandidates(error)) {
    const refusal = parseEntitlementRefusal(details)
    if (refusal)
      return refusal
  }
  return null
}

export type InspectRateLimit = IndexingInspectRateLimited['rateLimit']

/**
 * Why a URL Inspection request failed, when the reason is one the inspect UI
 * explains.
 *
 * Two different limits answer 429 `rate_limited`. The monthly Free allowance
 * carries `details.reason`; the daily per-Site pool carries no reason and
 * keeps its own message. They must never read as one limit.
 */
export type InspectFailure
  = | { _tag: 'Refused', refusal: EntitlementRefusal, message: string }
    | { _tag: 'DailyPool', rateLimit: InspectRateLimit, retryAfterSeconds: number }

export function inspectFailureOf(error: unknown): InspectFailure | null {
  const refusal = refusalFromError(error)
  if (refusal)
    return { _tag: 'Refused', refusal, message: refusalMessage(refusal) }
  if (isGscdumpV1Error(error) && error.code === 'rate_limited') {
    const details = error.details as { rateLimit?: InspectRateLimit, retryAfterSeconds?: number }
    return {
      _tag: 'DailyPool',
      rateLimit: details.rateLimit ?? { reserved: 0, remaining: 0, limit: 0 },
      retryAfterSeconds: details.retryAfterSeconds ?? 0,
    }
  }
  return null
}
