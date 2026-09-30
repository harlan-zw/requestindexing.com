import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it } from 'vitest'
import { inspectFailureOf, refusalFromError } from './entitlement-refusal'

function v1Error(status: number, code: 'invalid_request' | 'rate_limited', details: Record<string, unknown>): GscdumpV1Error {
  return new GscdumpV1Error({ code, status, message: 'Use Local mode with your own Google keys.', details, retryable: code === 'rate_limited' })
}

describe('refusalFromError', () => {
  it('reads a refusal from a gscdump v1 error', () => {
    const refusal = refusalFromError(v1Error(409, 'invalid_request', { reason: 'site_allowance', limit: 3 }))

    expect(refusal).toEqual({ reason: 'site_allowance', limit: 3 })
  })

  it('reads a refusal from a Request Indexing API error envelope', () => {
    // `$fetch` puts the response body on `data`; the envelope sits on `data.data`.
    const fetchError = { statusCode: 409, data: { statusMessage: 'conflict', data: { code: 'conflict', message: '…', requestId: 'r', details: { reason: 'duplicate_property', siteUrl: 'https://example.com/' } } } }

    expect(refusalFromError(fetchError)).toEqual({ reason: 'duplicate_property', siteUrl: 'https://example.com/' })
  })

  it('reads a refusal from a server-side H3 error that carries the v1 details', () => {
    const h3Error = { statusCode: 409, data: { code: 'invalid_request', details: { reason: 'site_held', hold: 'size_pending' } } }

    expect(refusalFromError(h3Error)).toEqual({ reason: 'site_held', hold: 'size_pending' })
  })

  it('returns null for a failure that is not an entitlement refusal', () => {
    expect(refusalFromError(v1Error(409, 'invalid_request', { field: 'siteUrl' }))).toBeNull()
    expect(refusalFromError(new Error('network down'))).toBeNull()
    expect(refusalFromError(null)).toBeNull()
  })
})

describe('inspectFailureOf', () => {
  it('reads the monthly Free allowance refusal, which is a 429 with a reason', () => {
    const failure = inspectFailureOf(v1Error(429, 'rate_limited', { reason: 'inspection_allowance', limit: 5_000, resetsAt: '2026-11-01' }))

    expect(failure).toEqual({
      _tag: 'Refused',
      refusal: { reason: 'inspection_allowance', limit: 5_000, resetsAt: '2026-11-01' },
      message: 'You used the 5,000 URL Inspections in this month\'s Free allowance. URL Inspection starts again on November 1.',
    })
  })

  it('keeps the daily per-Site pool apart: a 429 with no reason', () => {
    const failure = inspectFailureOf(v1Error(429, 'rate_limited', {
      rateLimit: { reserved: 0, remaining: 0, limit: 1_800 },
      retryAfterSeconds: 3_600,
    }))

    expect(failure).toEqual({
      _tag: 'DailyPool',
      rateLimit: { reserved: 0, remaining: 0, limit: 1_800 },
      retryAfterSeconds: 3_600,
    })
  })

  it('reads a held Site refusal on inspect', () => {
    const failure = inspectFailureOf(v1Error(409, 'invalid_request', { reason: 'site_held', hold: 'size_limit' }))

    expect(failure?._tag).toBe('Refused')
  })

  it('returns null for an unrelated failure, so the caller rethrows it', () => {
    expect(inspectFailureOf(v1Error(409, 'invalid_request', {}))).toBeNull()
  })
})
