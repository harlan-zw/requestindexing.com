import { describe, expect, it } from 'vitest'
import { GSC_SCOPE_MISSING_ERROR, isGscScopeMissingError, parseGscConnectReturn, resolveGoogleOAuthError, resolveGscGrant } from './gsc-grant'

const EMAIL = 'https://www.googleapis.com/auth/userinfo.email openid'
const WEBMASTERS = 'https://www.googleapis.com/auth/webmasters'
const WEBMASTERS_READ = 'https://www.googleapis.com/auth/webmasters.readonly'
const INDEXING = 'https://www.googleapis.com/auth/indexing'

describe('resolveGscGrant', () => {
  it('reports a missing scope when the Search Console box was unticked', () => {
    expect(resolveGscGrant(`${EMAIL} ${INDEXING}`)).toEqual({ _tag: 'ScopeMissing' })
    expect(resolveGscGrant(EMAIL)).toEqual({ _tag: 'ScopeMissing' })
    expect(resolveGscGrant('')).toEqual({ _tag: 'ScopeMissing' })
  })

  it('accepts the read-write or the read-only Search Console scope', () => {
    expect(resolveGscGrant(`${EMAIL} ${WEBMASTERS} ${INDEXING}`)).toEqual({ _tag: 'Granted' })
    expect(resolveGscGrant(`${EMAIL} ${WEBMASTERS_READ}`)).toEqual({ _tag: 'Granted' })
  })

  it('reports unknown when Google returned no scope list', () => {
    expect(resolveGscGrant(undefined)).toEqual({ _tag: 'Unknown' })
    expect(resolveGscGrant(null)).toEqual({ _tag: 'Unknown' })
  })
})

describe('isGscScopeMissingError', () => {
  it('matches only the scope-missing error value', () => {
    expect(isGscScopeMissingError(GSC_SCOPE_MISSING_ERROR)).toBe(true)
    expect(isGscScopeMissingError('google_auth_failed')).toBe(false)
    expect(isGscScopeMissingError(undefined)).toBe(false)
    expect(isGscScopeMissingError([GSC_SCOPE_MISSING_ERROR])).toBe(false)
  })
})

describe('resolveGoogleOAuthError', () => {
  it('reads a denied or closed consent screen as cancelled', () => {
    expect(resolveGoogleOAuthError('access_denied')).toEqual({ _tag: 'Cancelled' })
  })

  it('reads any other Google error as a failed connection and keeps a safe code', () => {
    expect(resolveGoogleOAuthError('invalid_scope')).toEqual({ _tag: 'Failed', reason: 'invalid_scope' })
    expect(resolveGoogleOAuthError('server_error')).toEqual({ _tag: 'Failed', reason: 'server_error' })
  })

  it('drops an error value that is not a Google error code', () => {
    expect(resolveGoogleOAuthError('<script>')).toEqual({ _tag: 'Failed', reason: 'unknown' })
    expect(resolveGoogleOAuthError(['access_denied'])).toEqual({ _tag: 'Failed', reason: 'unknown' })
  })
})

describe('parseGscConnectReturn', () => {
  it('reads the markers the callback sets when Google returns without a grant', () => {
    expect(parseGscConnectReturn('gsc_connect_cancelled')).toEqual({ _tag: 'Cancelled' })
    expect(parseGscConnectReturn('gsc_connect_failed')).toEqual({ _tag: 'Failed' })
  })

  it('ignores the scope marker, unrelated values and arrays', () => {
    expect(parseGscConnectReturn(GSC_SCOPE_MISSING_ERROR)).toBeNull()
    expect(parseGscConnectReturn('google_auth_failed')).toBeNull()
    expect(parseGscConnectReturn(['gsc_connect_failed'])).toBeNull()
    expect(parseGscConnectReturn(undefined)).toBeNull()
  })
})
