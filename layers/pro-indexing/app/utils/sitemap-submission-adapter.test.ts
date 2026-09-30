import type { SitemapLiveness } from '../../shared/contracts/sitemap-liveness'
import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it } from 'vitest'
import { sitemapSubmissionFromLiveness, sitemapSubmissionFromSubmit } from './sitemap-submission-adapter'

const SITEMAP = 'https://example.com/sitemap.xml'

function liveness(overrides: Partial<SitemapLiveness>): SitemapLiveness {
  return { status: 'reachable', statusCode: 200, durationMs: 10, checkedAt: '2026-09-30T00:00:00.000Z', url: SITEMAP, ...overrides }
}

function refusal(status: number, details: Record<string, unknown> = {}) {
  return new GscdumpV1Error({ code: status === 403 ? 'forbidden' : 'rate_limited', message: 'refused', status, retryable: false, details })
}

describe('sitemapSubmissionFromLiveness', () => {
  it('offers the probed sitemap URL for submission', () => {
    expect(sitemapSubmissionFromLiveness(liveness({}))).toEqual({ _tag: 'ready', sitemapUrl: SITEMAP })
  })

  it('reports no sitemap when the probe found none', () => {
    expect(sitemapSubmissionFromLiveness(liveness({ status: 'error', statusCode: 404 }))).toEqual({ _tag: 'no_sitemap' })
  })

  it.each([
    ['a reachable probe without a URL', liveness({ url: undefined })],
    ['a server error', liveness({ status: 'error', statusCode: 500 })],
    ['a timeout', liveness({ status: 'timeout', statusCode: null })],
  ])('has no submission state for %s', (_, input) => {
    expect(sitemapSubmissionFromLiveness(input)).toBeNull()
  })
})

describe('sitemapSubmissionFromSubmit', () => {
  it('reports the sitemap Search Console accepted', () => {
    const data = { success: true, action: 'submitted' as const, sitemapUrl: SITEMAP, sitemapCount: 1 }
    const result = sitemapSubmissionFromSubmit({ _tag: 'ok', data }, SITEMAP)
    expect(result).toEqual({ _tag: 'submitted', sitemapUrl: SITEMAP })
  })

  it('has no submission state when the engine reports the submit unsuccessful', () => {
    const data = { success: false, action: 'submitted' as const, sitemapUrl: SITEMAP, sitemapCount: 0 }
    expect(sitemapSubmissionFromSubmit({ _tag: 'ok', data }, SITEMAP)).toBeNull()
  })

  it('asks for write access when Google refuses the token scope', () => {
    const error = refusal(403, { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', status: 'PERMISSION_DENIED' })
    const result = sitemapSubmissionFromSubmit({ _tag: 'error', error }, SITEMAP)
    expect(result).toEqual({ _tag: 'needs_write_access', sitemapUrl: SITEMAP })
  })

  it('reports missing property permission for any other 403', () => {
    const error = refusal(403, { reason: 'forbidden', status: 'PERMISSION_DENIED' })
    const result = sitemapSubmissionFromSubmit({ _tag: 'error', error }, SITEMAP)
    expect(result).toEqual({ _tag: 'insufficient_permission', sitemapUrl: SITEMAP })
  })

  it.each([
    ['a rate limit', refusal(429)],
    ['a network failure', new TypeError('fetch failed')],
  ])('has no submission state for %s', (_, error) => {
    expect(sitemapSubmissionFromSubmit({ _tag: 'error', error }, SITEMAP)).toBeNull()
  })
})
