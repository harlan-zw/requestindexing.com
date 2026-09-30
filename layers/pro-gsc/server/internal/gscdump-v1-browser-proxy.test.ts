import type { Caller } from '#layers/pro-saas/shared/caller'
import { describe, expect, it } from 'vitest'
import {
  getGscdumpV1ProxySiteId,
  resolveGscdumpV1ProxyOperation,
  selectGscdumpV1SiteAccess,
} from './gscdump-v1-browser-proxy'

function makeCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    user: { id: 1, email: null, name: null, avatarUrl: null, providers: [], createdAt: null },
    memberships: [],
    currentTeamId: null,
    isAdmin: false,
    ...overrides,
  }
}

describe('resolveGscdumpV1ProxyOperation', () => {
  it('resolves an allowlisted operation by method, surface, and path', () => {
    const resolved = resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing')
    expect(resolved?.operation.id).toBe('partner.sites.indexing.get')
    expect(resolved?.params).toEqual({ siteId: 's_site-1' })
  })

  // Regression: both trend operations were missing from the allowlist, so the
  // proxy answered 404 and four of five site cards on `/dashboard` rendered
  // "Site data could not load". `useGscdumpSiteSummary` calls both per card.
  it('resolves the query-trend operation the dashboard site cards call', () => {
    const resolved = resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/query-trend')
    expect(resolved?.operation.id).toBe('partner.sites.query.trend.get')
    expect(resolved?.params).toEqual({ siteId: 's_site-1' })
  })

  it('resolves the page-trend operation the dashboard site cards call', () => {
    const resolved = resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/page-trend')
    expect(resolved?.operation.id).toBe('partner.sites.page.trend.get')
    expect(resolved?.params).toEqual({ siteId: 's_site-1' })
  })

  it('resolves the keyword-sparklines operation the tables batch their rows through', () => {
    const resolved = resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/keyword-sparklines')
    expect(resolved?.operation.id).toBe('partner.sites.keyword.sparklines.query')
    expect(resolved?.params).toEqual({ siteId: 's_site-1' })
  })

  it('resolves the grouped analytics rows read the page and country sparklines use', () => {
    const resolved = resolveGscdumpV1ProxyOperation('POST', 'analytics', 'sites/s_site-1/rows')
    expect(resolved?.operation.id).toBe('analytics.rows.query')
  })

  // The two Bing pages are behind `NUXT_PUBLIC_FEATURES_BING`. With the flag
  // off they do not exist, so the relay must not carry their reads either.
  it('rejects every Bing operation while the flag is off', () => {
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/bing/data')).toBeNull()
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing/bing/connection')).toBeNull()
    expect(resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/connection/verify')).toBeNull()
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/bing/data', { bing: false })).toBeNull()
  })

  it('resolves the three Bing operations while the flag is on', () => {
    const flags = { bing: true }
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/bing/data', flags)?.operation.id)
      .toBe('partner.sites.bing.data.get')
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing/bing/connection', flags)?.operation.id)
      .toBe('partner.sites.indexing.bing.connection.get')
    expect(resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/connection/verify', flags)?.operation.id)
      .toBe('partner.sites.indexing.bing.connection.verify')
  })

  // The crawl view reads the `crawl` dataset of `bing.data.get`, so nothing
  // needs per-URL evidence rows and the relay stays as narrow as the pages.
  it('rejects the Bing evidence operation even while the flag is on', () => {
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing/bing/evidence', { bing: true })).toBeNull()
  })

  it.each([
    ['GET', 'connection', 'partner.sites.indexing.indexnow.connection.get'],
    ['POST', 'connection', 'partner.sites.indexing.indexnow.connection.configure'],
    ['POST', 'connection/verify', 'partner.sites.indexing.indexnow.connection.verify'],
    ['POST', 'submissions', 'partner.sites.indexing.indexnow.submissions.create'],
    ['GET', 'submissions', 'partner.sites.indexing.indexnow.submissions.list'],
  ])('routes IndexNow %s %s through site ownership checks', (method, path, id) => {
    const operation = resolveGscdumpV1ProxyOperation(method, 'partner', `sites/s_site-1/indexing/indexnow/${path}`)
    expect(operation?.operation.id).toBe(id)
    expect(operation && getGscdumpV1ProxySiteId(operation)).toBe('s_site-1')
  })

  it('rejects a path with no matching operation', () => {
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'users/u_1')).toBeNull()
  })

  it('rejects a real registry operation that is not on the browser allowlist', () => {
    // `partner.sites.delete` (DELETE /sites/{siteId}) exists in the frozen
    // v1 registry but was never added to the browser allowlist.
    expect(resolveGscdumpV1ProxyOperation('DELETE', 'partner', 'sites/s_site-1')).toBeNull()
  })

  it('rejects a method mismatch on an otherwise-valid path', () => {
    expect(resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing')).toBeNull()
  })

  it('rejects path traversal in a path parameter', () => {
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/../secrets/indexing')).toBeNull()
  })
})

describe('getGscdumpV1ProxySiteId', () => {
  it('extracts the siteId path parameter', () => {
    const resolved = resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing')!
    expect(getGscdumpV1ProxySiteId(resolved)).toBe('s_site-1')
  })

  it('returns null for an operation with no siteId parameter', () => {
    const resolved = resolveGscdumpV1ProxyOperation('POST', 'realtime', 'tickets')!
    expect(getGscdumpV1ProxySiteId(resolved)).toBeNull()
  })
})

describe('selectGscdumpV1SiteAccess', () => {
  it('treats a missing site as not found', () => {
    expect(selectGscdumpV1SiteAccess(makeCaller(), null, false)).toEqual({ _tag: 'site_not_found' })
  })

  it('allows the owning team\'s owner to read', () => {
    const caller = makeCaller({
      memberships: [{ teamId: 42, teamName: 'Personal', role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
    })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [42] }, false)).toEqual({ _tag: 'allowed' })
  })

  it('hides existence from a caller with no team access', () => {
    const caller = makeCaller({ memberships: [] })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [7] }, false)).toEqual({ _tag: 'site_not_found' })
  })

  it('allows a team viewer to read', () => {
    const caller = makeCaller({
      memberships: [{ teamId: 7, teamName: 'Team', role: 'viewer', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [7] }, false)).toEqual({ _tag: 'allowed' })
  })

  it('forbids a team viewer from writing', () => {
    const caller = makeCaller({
      memberships: [{ teamId: 7, teamName: 'Team', role: 'viewer', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [7] }, true)).toEqual({ _tag: 'forbidden' })
  })

  it('allows a team editor to write', () => {
    const caller = makeCaller({
      memberships: [{ teamId: 7, teamName: 'Team', role: 'editor', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [7] }, true)).toEqual({ _tag: 'allowed' })
  })

  it('does not grant access via an unrelated team the caller belongs to', () => {
    const caller = makeCaller({
      memberships: [{ teamId: 5, teamName: 'Other team', role: 'admin', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [7] }, false)).toEqual({ _tag: 'site_not_found' })
  })

  it('lets an admin caller bypass membership entirely', () => {
    const caller = makeCaller({ isAdmin: true })
    expect(selectGscdumpV1SiteAccess(caller, { teamIds: [] }, true)).toEqual({ _tag: 'allowed' })
  })
})
