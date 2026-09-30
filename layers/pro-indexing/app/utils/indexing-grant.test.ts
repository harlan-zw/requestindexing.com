import { describe, expect, it } from 'vitest'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'
import { indexingGrantHref, readIndexingGrantRefusal, resolveSubmitAction } from './indexing-grant'

const SUBMIT_PAGE = '/pro/dashboard/sites/s_kv1109/indexing/submit'
const GRANT_HREF = '/auth/google-indexing?returnTo=%2Fpro%2Fdashboard%2Fsites%2Fs_kv1109%2Findexing%2Fsubmit'

// The submit route's error body, as `$fetch` rejects with it.
function refusedWith(reason: string) {
  return { statusCode: 401, data: { statusCode: 401, statusMessage: 'prose that may change', data: { reason } } }
}

describe('indexingGrantHref', () => {
  it('carries a return path the grant route accepts', () => {
    const returnTo = new URL(indexingGrantHref(SUBMIT_PAGE), 'https://requestindexing.com').searchParams.get('returnTo')
    expect(safeAuthRedirect(returnTo)).toBe(SUBMIT_PAGE)
  })
})

describe('readIndexingGrantRefusal', () => {
  it.each([
    ['missing_grant', 'missing'],
    ['invalid_grant', 'rejected'],
  ])('reads the %s reason code', (reason, expected) => {
    expect(readIndexingGrantRefusal(refusedWith(reason))).toBe(expected)
  })

  it.each([
    ['a quota refusal', refusedWith('quota_exceeded')],
    ['an unverified property', refusedWith('unverified_property')],
    ['a network failure', new TypeError('fetch failed')],
    ['nothing', undefined],
  ])('ignores %s', (_label, error) => {
    expect(readIndexingGrantRefusal(error)).toBeNull()
  })
})

describe('resolveSubmitAction', () => {
  const base = { grant: null, grantUnavailable: false, refusal: null, returnTo: SUBMIT_PAGE } as const

  it('offers the grant beside Submit when the account has no Indexing API grant', () => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'Missing' } }))
      .toEqual({ _tag: 'GrantAccess', cause: 'missing', to: GRANT_HREF })
  })

  it('submits when the account holds a grant', () => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'Granted', googleEmail: 'dev@example.com' } }))
      .toEqual({ _tag: 'Submit' })
  })

  it('waits for the grant read before offering either action', () => {
    expect(resolveSubmitAction(base)).toEqual({ _tag: 'Checking' })
  })

  it('keeps Submit when the grant read fails, so the submit route decides', () => {
    expect(resolveSubmitAction({ ...base, grantUnavailable: true })).toEqual({ _tag: 'Submit' })
  })

  it.each([
    ['missing', { _tag: 'Granted', googleEmail: null }],
    ['rejected', { _tag: 'Granted', googleEmail: 'dev@example.com' }],
  ] as const)('offers the grant after the submit route refuses a %s grant', (refusal, grant) => {
    expect(resolveSubmitAction({ ...base, grant, refusal }))
      .toEqual({ _tag: 'GrantAccess', cause: refusal, to: GRANT_HREF })
  })
})
