import { describe, expect, it } from 'vitest'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'
import { describeSubmissionRefusal, indexingGrantHref, readIndexingGrantRefusal, readSubmissionRefusal, resolveSubmitAction } from './indexing-grant'

const SUBMIT_PAGE = '/pro/dashboard/sites/s_kv1109/indexing/submit'
const GRANT_HREF = '/auth/google-indexing?returnTo=%2Fpro%2Fdashboard%2Fsites%2Fs_kv1109%2Findexing%2Fsubmit'
const grantedAt = '2026-10-01T00:00:00.000Z'

// The submit route's error body, as `$fetch` rejects with it.
function refusedWith(refusal: unknown) {
  return { statusCode: 409, data: { statusCode: 409, statusMessage: 'prose that may change', data: { code: 'invalid_request', refusal } } }
}

describe('indexingGrantHref', () => {
  it('carries a return path the grant route accepts', () => {
    const returnTo = new URL(indexingGrantHref(SUBMIT_PAGE), 'https://requestindexing.com').searchParams.get('returnTo')
    expect(safeAuthRedirect(returnTo)).toBe(SUBMIT_PAGE)
  })
})

describe('readIndexingGrantRefusal', () => {
  it.each([
    ['missing', 'missing'],
    ['reauthorization-required', 'rejected'],
  ] as const)('reads a %s grant from the refusal details', (grant, expected) => {
    expect(readIndexingGrantRefusal(refusedWith({ reason: 'needs_indexing_api_grant', grant }))).toBe(expected)
  })

  it.each([
    ['a daily limit refusal', refusedWith({ reason: 'site_daily_limit', limit: 5, resetsAt: grantedAt })],
    ['an unknown refusal', refusedWith({ reason: 'something_new' })],
    ['a network failure', new TypeError('fetch failed')],
    ['nothing', undefined],
  ])('ignores %s', (_label, error) => {
    expect(readIndexingGrantRefusal(error)).toBeNull()
  })
})

describe('readSubmissionRefusal', () => {
  it('reads the refusal the route copied from gscdump', () => {
    expect(readSubmissionRefusal(refusedWith({ reason: 'url_outside_site' }))).toEqual({ reason: 'url_outside_site' })
  })

  it('returns null for a failure that is not a refusal', () => {
    expect(readSubmissionRefusal({ statusCode: 500, data: { statusCode: 500 } })).toBeNull()
  })
})

describe('describeSubmissionRefusal', () => {
  it('names both dates of a cooldown', () => {
    expect(describeSubmissionRefusal({ reason: 'cooling_down', lastAcceptedAt: '2026-10-01T12:00:00.000Z', availableAt: '2026-10-08T12:00:00.000Z' }))
      .toBe('Google accepted this URL on Oct 1, 2026. You can submit it again on Oct 8, 2026.')
  })

  it('names the daily limit gscdump applied', () => {
    expect(describeSubmissionRefusal({ reason: 'site_daily_limit', limit: 5, resetsAt: '2026-10-02T07:00:00.000Z' }))
      .toBe('This Site used its 5 Google Submissions for today. The daily limit resets at midnight Pacific Time.')
  })
})

describe('resolveSubmitAction', () => {
  const base = { grant: null, grantUnavailable: false, refusal: null, returnTo: SUBMIT_PAGE } as const

  it('offers the grant beside Submit when the account has no Indexing API grant', () => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'missing' } }))
      .toEqual({ _tag: 'GrantAccess', cause: 'missing', to: GRANT_HREF })
  })

  it('asks for the grant again when Google stopped accepting it', () => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'reauthorization-required', googleEmail: null } }))
      .toEqual({ _tag: 'GrantAccess', cause: 'rejected', to: GRANT_HREF })
  })

  it('submits when the account holds a grant', () => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'granted', googleEmail: 'dev@example.com', grantedAt } }))
      .toEqual({ _tag: 'Submit' })
  })

  it('waits for the grant read before offering either action', () => {
    expect(resolveSubmitAction(base)).toEqual({ _tag: 'Checking' })
  })

  it('keeps Submit when the grant read fails, so gscdump decides', () => {
    expect(resolveSubmitAction({ ...base, grantUnavailable: true })).toEqual({ _tag: 'Submit' })
  })

  it.each(['missing', 'rejected'] as const)('offers the grant after gscdump refuses a %s grant', (refusal) => {
    expect(resolveSubmitAction({ ...base, grant: { _tag: 'granted', googleEmail: null, grantedAt }, refusal }))
      .toEqual({ _tag: 'GrantAccess', cause: refusal, to: GRANT_HREF })
  })
})
