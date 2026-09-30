import type { Caller } from '#layers/pro-saas/shared/caller'
import { describe, expect, it } from 'vitest'
import {
  resolveGscdumpV1ProxyOperation,
  selectGscdumpV1ProxyBody,
  selectGscdumpV1ProxyTarget,
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

  it('resolves the grouped analytics rows read every sparkline uses', () => {
    const resolved = resolveGscdumpV1ProxyOperation('POST', 'analytics', 'sites/s_site-1/rows')
    expect(resolved?.operation.id).toBe('analytics.rows.query')
  })

  // Every Bing surface is behind `NUXT_PUBLIC_FEATURES_BING`. With the flag
  // off the pages do not exist, so the relay must not carry their calls either.
  it.each([
    ['GET', 'sites/s_site-1/bing/data'],
    ['GET', 'sites/s_site-1/indexing/bing/connection'],
    ['POST', 'sites/s_site-1/indexing/bing/connection/verify'],
    ['GET', 'sites/s_site-1/indexing/bing/evidence'],
    ['POST', 'sites/s_site-1/indexing/bing/link'],
    ['POST', 'sites/s_site-1/indexing/bing/authorization'],
    ['POST', 'sites/s_site-1/indexing/bing/sitemaps'],
    ['GET', 'users/u_1/indexing/bing/sites'],
  ])('rejects Bing %s %s while the flag is off', (method, path) => {
    expect(resolveGscdumpV1ProxyOperation(method, 'partner', path)).toBeNull()
    expect(resolveGscdumpV1ProxyOperation(method, 'partner', path, { bing: false })).toBeNull()
  })

  it.each([
    ['GET', 'sites/s_site-1/bing/data', 'partner.sites.bing.data.get'],
    ['GET', 'sites/s_site-1/indexing/bing/connection', 'partner.sites.indexing.bing.connection.get'],
    ['POST', 'sites/s_site-1/indexing/bing/connection/verify', 'partner.sites.indexing.bing.connection.verify'],
    ['GET', 'sites/s_site-1/indexing/bing/evidence', 'partner.sites.indexing.bing.evidence.list'],
    ['POST', 'sites/s_site-1/indexing/bing/link', 'partner.sites.indexing.bing.link.create'],
    ['POST', 'sites/s_site-1/indexing/bing/authorization', 'partner.sites.indexing.bing.authorization.create'],
    ['POST', 'sites/s_site-1/indexing/bing/sitemaps', 'partner.sites.indexing.bing.sitemaps.submit'],
    ['GET', 'users/u_1/indexing/bing/sites', 'partner.users.indexing.bing.sites.list'],
  ])('resolves Bing %s %s while the flag is on', (method, path, id) => {
    expect(resolveGscdumpV1ProxyOperation(method, 'partner', path, { bing: true })?.operation.id).toBe(id)
  })

  // Google Sitemap submission belongs to the Sitemaps page, which does not
  // call these yet. The Bing flag must not open them as a side effect.
  it('rejects Google Sitemap submission even while the Bing flag is on', () => {
    expect(resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/sitemaps/submission', { bing: true })).toBeNull()
    expect(resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/sitemaps/submission', { bing: true })).toBeNull()
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
    expect(operation && selectGscdumpV1ProxyTarget(operation, 'u_me')).toMatchObject({ _tag: 'site', siteId: 's_site-1' })
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

describe('selectGscdumpV1ProxyTarget', () => {
  const flags = { bing: true }

  it('checks a Site read against the Site, with no write needed', () => {
    const operation = resolveGscdumpV1ProxyOperation('GET', 'partner', 'sites/s_site-1/indexing/bing/evidence', flags)!
    expect(selectGscdumpV1ProxyTarget(operation, 'u_me')).toEqual({
      _tag: 'site',
      siteId: 's_site-1',
      requiresWrite: false,
      path: 'sites/s_site-1/indexing/bing/evidence',
    })
  })

  // Linking, authorizing, verifying, and submitting change Bing state for the
  // Site, so a Team viewer must be refused before gscdump is asked.
  it.each([
    'sites/s_site-1/indexing/bing/link',
    'sites/s_site-1/indexing/bing/authorization',
    'sites/s_site-1/indexing/bing/sitemaps',
    'sites/s_site-1/indexing/bing/connection/verify',
  ])('needs write access on the Site for POST %s', (path) => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'partner', path, flags)!
    expect(selectGscdumpV1ProxyTarget(operation, 'u_me')).toEqual({ _tag: 'site', siteId: 's_site-1', requiresWrite: true, path })
  })

  it('refuses a Team viewer who tries to link Bing for a Team Site', () => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/link', flags)!
    const target = selectGscdumpV1ProxyTarget(operation, 'u_me')
    const viewer = makeCaller({
      memberships: [{ teamId: 7, teamName: 'Team', role: 'viewer', isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    })
    expect(target._tag === 'site' && selectGscdumpV1SiteAccess(viewer, { teamIds: [7] }, target.requiresWrite))
      .toEqual({ _tag: 'forbidden' })
  })

  // The browser never learns its gscdump user id. Whatever id it sends, the
  // upstream path names the caller's own stored id.
  it.each([
    ['GET', 'users/u_someone-else/indexing/bing/sites', 'users/u_me/indexing/bing/sites'],
    ['GET', 'users/u_session-proxy/available-sites', 'users/u_me/available-sites'],
  ])('sends %s %s upstream as the caller\'s own gscdump user', (method, path, upstream) => {
    const operation = resolveGscdumpV1ProxyOperation(method, 'partner', path, flags)!
    expect(selectGscdumpV1ProxyTarget(operation, 'u_me')).toEqual({ _tag: 'self', path: upstream })
  })

  it('refuses a user operation when the caller has no gscdump user', () => {
    const operation = resolveGscdumpV1ProxyOperation('GET', 'partner', 'users/u_someone-else/indexing/bing/sites', flags)!
    expect(selectGscdumpV1ProxyTarget(operation, null)).toEqual({ _tag: 'self-missing' })
  })

  it('forwards an operation with no Site or user as it came', () => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'realtime', 'tickets')!
    expect(selectGscdumpV1ProxyTarget(operation, 'u_me')).toEqual({ _tag: 'caller', path: 'tickets' })
  })
})

describe('selectGscdumpV1ProxyBody', () => {
  const flags = { bing: true }
  const context = { origin: 'https://requestindexing.com' }

  // Where Microsoft returns the browser is host policy. The browser cannot
  // choose it, so an open redirect through gscdump's allowlist is impossible.
  it.each([undefined, null, {}])('sends the Integrations return URL for a Bing authorization body of %j', (raw) => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/authorization', flags)!
    expect(selectGscdumpV1ProxyBody(operation, raw, context)).toEqual({
      _tag: 'Ok',
      body: { returnUrl: 'https://requestindexing.com/pro/dashboard/integrations' },
    })
  })

  it('refuses a Bing authorization body that names its own return URL', () => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/authorization', flags)!
    expect(selectGscdumpV1ProxyBody(operation, { returnUrl: 'https://nuxtseo.com/pro' }, context)).toEqual({ _tag: 'Err' })
  })

  it('sends the request origin for a realtime ticket and refuses a chosen one', () => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'realtime', 'tickets')!
    expect(selectGscdumpV1ProxyBody(operation, {}, context)).toEqual({ _tag: 'Ok', body: { origin: 'https://requestindexing.com' } })
    expect(selectGscdumpV1ProxyBody(operation, { origin: 'https://attacker.example' }, context)).toEqual({ _tag: 'Err' })
  })

  it('passes any other body through for the schema to parse', () => {
    const operation = resolveGscdumpV1ProxyOperation('POST', 'partner', 'sites/s_site-1/indexing/bing/sitemaps', flags)!
    expect(selectGscdumpV1ProxyBody(operation, { url: 'https://example.com/sitemap.xml' }, context))
      .toEqual({ _tag: 'Ok', body: { url: 'https://example.com/sitemap.xml' } })
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
