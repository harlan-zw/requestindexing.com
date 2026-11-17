import { describe, expect, it } from 'vitest'
import { captureSignupTouch, parseSignupTouchCookie, resolveSignupAttribution } from './signup-attribution'

const now = Date.parse('2026-11-10T00:00:00Z')
describe('signup attribution', () => {
  it('keeps normalized campaign fields and a route group without a private URL', () => {
    const touch = captureSignupTouch({ path: '/tools/google-indexing-checker', query: { utm_source: ' My Newsletter ', utm_medium: 'EMAIL', url: 'https://private.example/page?secret=1' }, referrer: 'https://mail.example/private/path?secret=2', hostname: 'requestindexing.com', now })
    expect(touch).toEqual({ _tag: 'campaign', landingPath: '/tools', utmSource: 'my-newsletter', utmMedium: 'email', referrerDomain: 'mail.example', capturedAt: new Date(now).toISOString() })
    expect(resolveSignupAttribution(touch)).toMatchObject({ attributionSource: 'utm:my-newsletter', channelClass: 'owned', attributionBasis: 'journey_linked' })
  })
  it('does not mistake Google consent or a missing journey for acquisition evidence', () => {
    const touch = captureSignupTouch({ path: '/auth/google', query: {}, referrer: 'https://accounts.google.com/o/oauth2', hostname: 'requestindexing.com', now })
    expect(resolveSignupAttribution(touch)).toMatchObject({ attributionSource: 'unattributed', attributionBasis: 'auth_fallback' })
    expect(captureSignupTouch({ path: '/api/private', query: {}, hostname: 'requestindexing.com', now })).toBeNull()
  })
  it.each([
    ['/comparisons', '/comparisons'],
    ['/comparisons/vs-indexly', '/comparisons'],
    ['/indexing-api-for-blog-posts', '/guides'],
    ['/google-indexing-api-quota', '/guides'],
  ])('groups a first touch on %s as %s without keeping the slug', (path, landingPath) => {
    const touch = captureSignupTouch({ path, query: { utm_source: 'Docs' }, hostname: 'requestindexing.com', now })
    expect(touch).toEqual({ _tag: 'campaign', landingPath, utmSource: 'docs', capturedAt: new Date(now).toISOString() })
    expect(parseSignupTouchCookie(JSON.stringify(touch))).toEqual(touch)
  })
  it.each(['/pro', '/pro/other', '/api/x', '/admin', '/account', '/kit', '/team-invitations', '/privacy', '/terms', '/get-started', '/robots.txt', '/_ipx/w_800/image.png', '/two/segments'])('keeps %s out of the landing groups', (path) => {
    expect(captureSignupTouch({ path, query: { utm_source: 'docs' }, hostname: 'requestindexing.com', now })).toBeNull()
  })
  it('still reads a touch stored before the comparison group existed', () => {
    const stored = { _tag: 'direct', landingPath: '/guides', capturedAt: new Date(now).toISOString() }
    expect(parseSignupTouchCookie(JSON.stringify(stored))).toEqual(stored)
  })
  it('rejects malformed or expanded cookies at the boundary', () => {
    expect(parseSignupTouchCookie('{invalid')).toBeNull()
    expect(parseSignupTouchCookie(JSON.stringify({ _tag: 'referral', landingPath: '/tools', referrerDomain: 'example.com', capturedAt: new Date(now).toISOString(), url: 'private' }))).toBeNull()
  })
})
