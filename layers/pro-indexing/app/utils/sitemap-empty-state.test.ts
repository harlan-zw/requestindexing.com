import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import { describe, expect, it } from 'vitest'
import { resolveSitemapEmptyState } from './sitemap-empty-state'

type Submission = GscdumpV1OperationResponse<'partner.sites.sitemaps.submission.get'>['data']
const SITEMAP = 'https://example.com/sitemap.xml'
function resolve(state: Submission['state'], canSubmit = true, callerCanAct = true) {
  return resolveSitemapEmptyState({
    submission: { searchEngine: 'google', gscPropertyUrl: 'sc-domain:example.com', callerCanAct, state },
    result: null,
    pending: false,
    unavailable: false,
    canSubmit,
  })
}

describe('resolveSitemapEmptyState', () => {
  it('offers the URL-free submit only when the host and Team permit it', () => {
    const state: Submission['state'] = { _tag: 'ready', sitemapUrl: SITEMAP, writeAccess: 'unknown' }
    expect(resolve(state)).toMatchObject({ _tag: 'submit', action: { _tag: 'submit', label: 'Submit sitemap' } })
    expect(resolve(state, false)).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
    expect(resolve(state, true, false)).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
  })

  it('offers grant consent only to the caller who holds the grant', () => {
    const state: Submission['state'] = {
      _tag: 'needs-write-access',
      sitemapUrl: SITEMAP,
      requiredScope: 'https://www.googleapis.com/auth/webmasters',
      grantHolder: { _tag: 'caller' },
    }
    expect(resolve(state)).toMatchObject({ action: { _tag: 'allow_submission' } })
    expect(resolve(state, false)).toMatchObject({ action: { _tag: 'open_search_console' } })
    expect(resolve({ ...state, grantHolder: { _tag: 'site-owner', email: 'owner@example.com', name: null } })).toMatchObject({
      description: 'The Search Console connection for this Site is read only. Ask owner@example.com to allow sitemap submission.',
      action: { _tag: 'open_search_console' },
    })
  })

  it('names the owner when their property permission prevents submission', () => {
    expect(resolve({
      _tag: 'insufficient-permission',
      sitemapUrl: SITEMAP,
      permissionLevel: 'siteRestrictedUser',
      requiredPermissionLevels: ['siteOwner', 'siteFullUser'],
      grantHolder: { _tag: 'site-owner', email: 'owner@example.com', name: null },
    })).toMatchObject({
      description: 'Sitemap changes need Owner or Full permission on this Search Console property. Ask owner@example.com to check their permission.',
      action: { _tag: 'open_search_console' },
    })
  })

  it.each([
    { _tag: 'listed', checkedOn: '2026-10-04', sitemapCount: 1 },
    { _tag: 'awaiting-google', checkedOn: '2026-10-04', sitemapCount: 1, sitemapUrl: SITEMAP },
  ] satisfies Submission['state'][])('never offers another submission for $_tag', (state) => {
    expect(resolve(state)).toMatchObject({ _tag: 'submitted' })
  })

  it('renders a confirmed submission while the following read is pending', () => {
    expect(resolveSitemapEmptyState({
      submission: null,
      result: { _tag: 'submitted', sitemapUrl: SITEMAP, sitemapCount: 1 },
      pending: true,
      unavailable: true,
      canSubmit: true,
    })).toMatchObject({ _tag: 'submitted', title: 'Sitemap submitted to Search Console' })
  })

  it('offers installation only after the host found no sitemap', () => {
    expect(resolve({ _tag: 'no-sitemap-found', checkedOn: '2026-10-04' })).toMatchObject({ _tag: 'install' })
  })

  it('offers a retry before the host has checked', () => {
    expect(resolve({ _tag: 'not-checked' })).toMatchObject({ _tag: 'retry' })
  })

  it.each(['grant-missing', 'permission-lost'] as const)('never submits when the host reports %s', (reason) => {
    expect(resolve({ _tag: 'unavailable', reason })).toMatchObject({ _tag: 'submit', action: { _tag: 'open_search_console' } })
  })

  it('does not convert failed reads into an installation or submission prompt', () => {
    expect(resolveSitemapEmptyState({ submission: null, result: null, pending: false, unavailable: true, canSubmit: true }))
      .toMatchObject({ _tag: 'retry' })
  })
})
