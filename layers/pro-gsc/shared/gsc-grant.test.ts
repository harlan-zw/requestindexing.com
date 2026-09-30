import { describe, expect, it } from 'vitest'
import { GSC_SCOPE_MISSING_ERROR, isGscScopeMissingError, resolveGscGrant } from './gsc-grant'

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
