import type { DatabaseSync } from 'node:sqlite'
import type { Caller } from '#layers/pro-saas/shared/caller'
import { Readable } from 'node:stream'
import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { createError, getQuery, getRouterParam, getValidatedQuery, readBody, setResponseHeader } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import proxy from '#layers/pro-gsc/server/api/_gscdump/[surface]/v1/[...path]'
import disconnect from '#layers/pro-gsc/server/api/pro/gsc-disconnect-site.post'
import properties from '#layers/pro-gsc/server/api/pro/gsc-properties.get'
import link from '#layers/pro-gsc/server/api/pro/sites/[id]/link-gsc.post'
import { autoLinkGsc, waitForReadyGscdumpUser } from '#layers/pro-gsc/server/utils/auto-link-gsc'
import { releaseGscdumpSite } from '#layers/pro-gsc/server/utils/release-gscdump-site'
import { requireCurrentTeam } from '#layers/pro-saas/server/utils/require-current-team'
import { requireTeamSite } from '#layers/pro-saas/server/utils/require-team-site'
import { mockRequestEvent } from '../../../../tests/support/mock-request-event'
import cohorts from '../api/pro/sites/[id]/indexing/cohorts.get'
import cohortUrls from '../api/pro/sites/[id]/indexing/cohorts/urls.get'
import grant from '../api/sites/[siteId]/indexing/google-grant.get'
import submit from '../api/sites/[siteId]/indexing/google-submissions.post'

const external = vi.hoisted(() => ({
  lifecycle: vi.fn(),
  identity: vi.fn(),
  urls: vi.fn(),
  diagnostics: vi.fn(),
  grant: vi.fn(),
  submit: vi.fn(),
  deleteSite: vi.fn(),
  register: vi.fn(),
  available: vi.fn(),
  createTeam: vi.fn(),
  updateSiteTeam: vi.fn(),
  relay: vi.fn(),
  caller: {} as Caller,
}))
vi.hoisted(() => {
  ;(globalThis as { defineEventHandler?: unknown }).defineEventHandler = (handler: unknown) => handler
})
vi.mock('#layers/pro-saas/server/utils/get-caller', () => ({ requireCaller: async () => external.caller, getCaller: async () => external.caller }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', async () => ({
  ...await vi.importActual<Record<string, unknown>>('#layers/pro-gsc/server/utils/gscdump-client'),
  useGscdumpClient: () => ({ getUserLifecycle: external.lifecycle, getRegisteredHostIdentity: external.identity, getAvailableSites: external.available, getIndexingUrls: external.urls, getIndexingDiagnostics: external.diagnostics, deleteSite: external.deleteSite, registerSite: external.register, waitForUserReady: async () => {}, readSiteAccess: async () => ({ _tag: 'Readable' }) }),
}))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ getGscdumpApiUrl: () => 'https://engine.test/api', getGscdumpWebhookUrl: () => 'https://request.test/api/webhooks/gscdump', createGscdumpPublicV1Client: () => ({ getRegisteredHostIdentity: (input: { params: { siteId: string } }) => external.identity(input.params.siteId).then(data => ({ data })), getSiteIndexingApiGrant: external.grant, createSiteGoogleSubmission: external.submit, createTeam: external.createTeam, updateSiteTeam: external.updateSiteTeam }) }))
vi.mock('#layers/pro-gsc/server/utils/onboarding', () => ({ updateOnboardingState: async () => {} }))

const cases = [
  { name: 'cohort overview', route: cohorts, method: 'GET', query: '' },
  { name: 'cohort URLs', route: cohortUrls, method: 'GET', query: '?cohort=section:/docs' },
  { name: 'Site grant', route: grant, method: 'GET', query: '' },
  { name: 'Google submission', route: submit, method: 'POST', query: '' },
] as const

let sqlite: DatabaseSync
beforeEach(() => {
  sqlite = migratedDatabase()
  sqlite.exec(`
    INSERT INTO teams (team_id, public_id, name, personal_team, created_at, updated_at) VALUES (1, 't_owner', 'Owner', 1, 0, 0);
    INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, gscdump_user_id, created_at, updated_at)
      VALUES (1, 'u_local', 'Owner', 'owner@example.test', '', 0, 'owner-sub', 1, 'u_owner', 0, 0);
    UPDATE teams SET owner_id = 1 WHERE team_id = 1;
    INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, gscdump_user_id, created_at, updated_at)
      VALUES (2, 'u_member', 'Member', 'member@example.test', '', 0, 'member-sub', 1, 'u_third_member', 0, 0);
    INSERT INTO team_memberships (team_id, user_id, role) VALUES (1, 2, 'editor');
    INSERT INTO sites (id, public_id, team_id, owner_id, property, domain, active, gscdump_site_id, created_at, updated_at)
      VALUES ('local', 's_local', 1, 1, 'sc-domain:example.com', 'example.com', 1, 's_engine', 0, 0);
  `)
  const db = proDatabase(sqlite)
  external.caller = {
    user: { id: 1, email: 'owner@example.test', name: 'Owner', avatarUrl: null, providers: [], createdAt: null },
    currentTeamId: 1,
    isAdmin: false,
    memberships: [{ teamId: 1, teamName: 'Owner', role: 'owner', isOwner: true, isPersonal: true, firstVisitDismissedAt: null }],
  }
  vi.stubGlobal('useDrizzle', () => db)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getQuery', getQuery)
  vi.stubGlobal('getRouterParam', getRouterParam)
  vi.stubGlobal('getValidatedQuery', getValidatedQuery)
  vi.stubGlobal('readBody', readBody)
  vi.stubGlobal('setResponseHeader', setResponseHeader)
  vi.stubGlobal('requireCurrentTeam', requireCurrentTeam)
  vi.stubGlobal('requireTeamSite', requireTeamSite)
  vi.stubGlobal('autoLinkGsc', autoLinkGsc)
  vi.stubGlobal('waitForReadyGscdumpUser', waitForReadyGscdumpUser)
  vi.stubGlobal('useRuntimeConfig', () => ({ googleIndexing: {}, public: {} }))
  vi.stubGlobal('fetch', external.relay)
  external.lifecycle.mockReset().mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://other.test' }] })
  external.identity.mockReset().mockImplementation(async (siteId: string) => {
    const lifecycle = await external.lifecycle('u_owner')
    const matches = lifecycle.sites.filter((site: { siteId: string }) => site.siteId === siteId)
    if (!matches.length)
      throw new GscdumpV1Error({ code: 'site_not_found', status: 404, message: 'absent', retryable: false })
    if (matches.length > 1)
      throw new GscdumpV1Error({ code: 'conflict', status: 409, message: 'identity conflict', retryable: false })
    return { identity: { ...matches[0], userId: 'u_owner', teamId: 't_owner' } }
  })
  external.urls.mockReset().mockResolvedValue({ urls: [{ url: 'https://other.test/docs/private', verdict: 'not_indexed', sitemaps: [] }], pagination: { total: 1, hasMore: false }, meta: { siteUrl: 'https://other.test' } })
  external.diagnostics.mockReset().mockResolvedValue({ issues: [{ type: 'not_indexed', count: 1 }] })
  external.grant.mockReset().mockResolvedValue({ data: { _tag: 'granted', googleEmail: 'other@example.test' } })
  external.submit.mockReset().mockResolvedValue({ data: { submissionReceipt: { _tag: 'accepted' } } })
  external.deleteSite.mockReset().mockResolvedValue({ success: true })
  external.register.mockReset().mockResolvedValue({ _tag: 'Registered', registration: { siteId: 's_exact' } })
  external.createTeam.mockReset().mockResolvedValue({ data: { team: { id: 't_owner' } } })
  external.updateSiteTeam.mockReset().mockResolvedValue({ data: { ok: true, teamId: 't_owner' } })
  external.available.mockReset().mockResolvedValue({ sites: [{ siteUrl: 'sc-domain:example.com', siteId: 's_engine', registered: true, permissionLevel: 'siteOwner' }] })
  external.relay.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
})
afterEach(() => sqlite.close())

function request(test: { route: unknown, method: string, query: string }, input = { url: 'https://example.com/docs/page', idempotencyKey: 'unique-submission' } as Record<string, string>, params: Record<string, string> = { id: 's_local', siteId: 's_local' }) {
  const body = JSON.stringify(input)
  const req = Object.assign(Readable.from(test.method === 'POST' ? [Buffer.from(body)] : []), {
    url: `/api/sites/s_local${test.query}`,
    method: test.method,
    headers: { host: 'request.test', ...(test.method === 'POST' ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } : {}) },
  })
  const event = mockRequestEvent(req)
  event.context.params = params
  return (test.route as unknown as (event: unknown) => Promise<unknown>)(event)
}

describe('direct server reads prove the registered host', () => {
  it.each(cases)('accepts same-host $name at its real request boundary', async (test) => {
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    await expect(request(test)).resolves.toBeDefined()
    const operation = test.name === 'cohort overview' || test.name === 'cohort URLs' ? external.urls : test.name === 'Site grant' ? external.grant : external.submit
    expect(operation).toHaveBeenCalledOnce()
    if (test.method === 'POST') {
      expect(external.submit).toHaveBeenCalledWith({ params: { siteId: 's_engine' }, body: { url: 'https://example.com/docs/page', idempotencyKey: 'unique-submission' } })
    }
  })

  it.each(cases)('refuses mismatched $name before reaching its data plane', async (test) => {
    await expect(request(test)).rejects.toMatchObject({ statusCode: 403 })
    expect(external.urls).not.toHaveBeenCalled()
    expect(external.diagnostics).not.toHaveBeenCalled()
    expect(external.grant).not.toHaveBeenCalled()
    expect(external.submit).not.toHaveBeenCalled()
  })
  it.each(cases)('refuses a same-host foreign account for $name', async (test) => {
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_foreign', teamId: 't_foreign' } })
    await expect(request(test)).rejects.toMatchObject({ statusCode: 403 })
    expect(external.urls).not.toHaveBeenCalled()
    expect(external.grant).not.toHaveBeenCalled()
    expect(external.submit).not.toHaveBeenCalled()
  })
  it('refuses another upstream Team even when its principal and host match', async () => {
    sqlite.exec('UPDATE teams SET gscdump_team_id = \'t_expected\'')
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_owner', teamId: 't_foreign' } })
    await expect(request(cases[2])).rejects.toMatchObject({ statusCode: 403 })
    expect(external.grant).not.toHaveBeenCalled()
  })
  it.each(cases)('accepts a third-member registration for $name without owner lifecycle visibility', async (test) => {
    sqlite.exec('UPDATE teams SET gscdump_team_id = \'t_expected\'')
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_third_member', teamId: 't_expected' } })
    await expect(request(test)).resolves.toBeDefined()
    expect(external.lifecycle).not.toHaveBeenCalled()
  })
  it.each(cases)('fails closed on an identity outage for $name without lifecycle fallback', async (test) => {
    external.identity.mockRejectedValue(new GscdumpV1Error({ code: 'service_unavailable', status: 503, message: 'offline', retryable: true }))
    await expect(request(test)).rejects.toMatchObject({ statusCode: 503 })
    expect(external.lifecycle).not.toHaveBeenCalled()
    expect(external.urls).not.toHaveBeenCalled()
    expect(external.grant).not.toHaveBeenCalled()
    expect(external.submit).not.toHaveBeenCalled()
  })
})

describe('destructive consumers prove the registered host', () => {
  function release() {
    return releaseGscdumpSite(proDatabase(sqlite) as never, { siteId: 'local', gscdumpSiteId: 's_engine', siteUrl: 'example.com' }, external.deleteSite, external.identity)
  }
  function disconnectRequest() {
    return request({ route: disconnect, method: 'POST', query: '' }, { gscdumpSiteId: 's_engine' })
  }
  it.each([{ name: 'release', run: release }, { name: 'disconnect', run: disconnectRequest }])('refuses mismatched $name before deletion', async ({ run }) => {
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
  it.each([{ name: 'release', run: release }, { name: 'disconnect', run: disconnectRequest }])('deletes a proven same-host $name', async ({ run }) => {
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    await expect(run()).resolves.toBeDefined()
    expect(external.deleteSite).toHaveBeenCalledExactlyOnceWith('s_engine')
  })
  it('allows local cleanup without deletion when registration is authoritatively absent', async () => {
    external.lifecycle.mockResolvedValue({ sites: [] })
    await expect(release()).resolves.toEqual({ _tag: 'AlreadyAbsent' })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
  it('does not delete when lifecycle proof is unavailable', async () => {
    external.lifecycle.mockRejectedValue(new Error('offline'))
    await expect(release()).rejects.toMatchObject({ statusCode: 503 })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
  it('does not delete after the local proof row was removed', async () => {
    sqlite.exec('DELETE FROM sites WHERE id = \'local\'')
    await expect(release()).rejects.toMatchObject({ statusCode: 503 })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
  it('accepts identity registered by a third Team member despite empty owner lifecycles', async () => {
    sqlite.exec('UPDATE users SET gscdump_user_id = NULL WHERE user_id = 1')
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_third_member', teamId: 't_owner' } })
    await expect(release()).resolves.toEqual({ _tag: 'Deleted' })
    expect(external.deleteSite).toHaveBeenCalledExactlyOnceWith('s_engine')
    expect(external.lifecycle).not.toHaveBeenCalled()
  })
  it('does not trust a registration returned for a different Site ID', async () => {
    external.identity.mockResolvedValue({ identity: { siteId: 's_other', requestedUrl: 'https://example.com' } })
    await expect(release()).rejects.toMatchObject({ statusCode: 503 })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
  it('does not delete when authoritative records conflict', async () => {
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }, { siteId: 's_engine', requestedUrl: 'https://other.test' }] })
    await expect(release()).rejects.toMatchObject({ statusCode: 503 })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })
})

describe('automatic links bind the requested host', () => {
  it('repairs a cached same-host link owned by an unrelated account', async () => {
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_foreign', teamId: 't_foreign' } })
    await expect(autoLinkGsc({ db: proDatabase(sqlite) as never, user: { _tag: 'ReadyGscdumpUser', gscdumpUserId: 'u_owner' }, siteId: 'local', origin: 'https://example.com', availableSites: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner', registered: true, siteId: 's_engine' }] as never })).resolves.toEqual({ _tag: 'Linked', gscdumpSiteId: 's_exact' })
  })
  it('keeps a cached link after authoritative same-host proof', async () => {
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    await expect(autoLinkGsc({ db: proDatabase(sqlite) as never, user: { _tag: 'ReadyGscdumpUser', gscdumpUserId: 'u_owner' }, siteId: 'local', origin: 'https://example.com' })).resolves.toEqual({ _tag: 'Linked', gscdumpSiteId: 's_engine' })
    expect(external.register).not.toHaveBeenCalled()
  })

  it('replaces a cached link when the engine confirms the Site is missing', async () => {
    external.lifecycle.mockResolvedValue({ sites: [] })

    await expect(autoLinkGsc({ db: proDatabase(sqlite) as never, user: { _tag: 'ReadyGscdumpUser', gscdumpUserId: 'u_owner' }, siteId: 'local', origin: 'https://example.com' })).resolves.toEqual({ _tag: 'Linked', gscdumpSiteId: 's_exact' })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = \'local\'').get()).toMatchObject({ gscdump_site_id: 's_exact' })
    expect(external.deleteSite).not.toHaveBeenCalled()
  })

  it('registers the local host instead of reusing a broad-property Site for another host', async () => {
    sqlite.exec('UPDATE sites SET gscdump_site_id = NULL, domain = \'www.example.com\' WHERE id = \'local\'')
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    const result = await autoLinkGsc({ db: proDatabase(sqlite) as never, user: { _tag: 'ReadyGscdumpUser', gscdumpUserId: 'u_owner' }, siteId: 'local', origin: 'https://www.example.com', availableSites: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner', registered: true, siteId: 's_engine' }] as never })
    expect(result).toEqual({ _tag: 'Linked', gscdumpSiteId: 's_exact' })
    expect(external.register).toHaveBeenCalledWith(expect.objectContaining({ requestedUrl: 'www.example.com', gscPropertyUrl: 'sc-domain:example.com' }))
  })

  it('preserves the cached pointer when authoritative identity cannot be read', async () => {
    external.lifecycle.mockRejectedValue(new Error('offline'))
    await expect(autoLinkGsc({ db: proDatabase(sqlite) as never, user: { _tag: 'ReadyGscdumpUser', gscdumpUserId: 'u_owner' }, siteId: 'local', origin: 'https://example.com' })).rejects.toMatchObject({ statusCode: 503 })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = \'local\'').get()).toMatchObject({ gscdump_site_id: 's_engine' })
    expect(external.register).not.toHaveBeenCalled()
  })
})

describe('explicitly linking Search Console to an owning Personal Team', () => {
  function relink() {
    return request({ route: link, method: 'POST', query: '' }, { gscSiteUrl: 'sc-domain:example.com' })
  }

  it('repairs the stale Team before proving a cached registration', async () => {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = 1').run('t_stale')
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })

    await expect(relink()).resolves.toMatchObject({ success: true, gscdumpSiteId: 's_engine' })
    expect(sqlite.prepare('SELECT gscdump_team_id FROM teams WHERE team_id = 1').get()).toMatchObject({ gscdump_team_id: 't_owner' })
    expect(external.register).not.toHaveBeenCalled()
    expect(external.updateSiteTeam).not.toHaveBeenCalled()
  })

  it.each(['A', 'A'.repeat(61)])('repairs a Personal Team with a legacy name length', async (name) => {
    sqlite.prepare('UPDATE teams SET name = ?, gscdump_team_id = ? WHERE team_id = 1').run(name, 't_stale')
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    external.createTeam.mockImplementationOnce(async ({ body }) => {
      if (body.name.trim().length < 2 || body.name.trim().length > 60)
        throw new Error('Team name must be 2–60 characters')
      return { data: { team: { id: 't_owner' } } }
    })

    await expect(relink()).resolves.toMatchObject({ success: true, gscdumpSiteId: 's_engine' })
    expect(sqlite.prepare('SELECT name, gscdump_team_id FROM teams WHERE team_id = 1').get()).toMatchObject({ name, gscdump_team_id: 't_owner' })
  })

  it('leaves the Site pointer intact if an existing registration cannot bind', async () => {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = 1').run('t_stale')
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.register.mockResolvedValue({ _tag: 'Registered', registration: { siteId: 's_exact', existing: true } })
    external.updateSiteTeam.mockRejectedValue(new Error('Team migration is required'))

    await expect(relink()).rejects.toMatchObject({ statusCode: 503 })
    expect(external.updateSiteTeam).toHaveBeenCalledWith({ params: { siteId: 's_exact' }, body: { teamId: 't_owner' } })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = ?').get('local')).toMatchObject({ gscdump_site_id: 's_engine' })
  })

  it('replaces an absent registration for the saved host under a covering Domain property', async () => {
    sqlite.prepare('UPDATE teams SET gscdump_team_id = ? WHERE team_id = 1').run('t_stale')
    sqlite.prepare('UPDATE sites SET domain = ? WHERE id = ?').run('www.example.com', 'local')
    external.lifecycle.mockResolvedValue({ sites: [] })

    await expect(relink()).resolves.toMatchObject({ success: true, gscdumpSiteId: 's_exact', gscdumpSiteUrl: 'www.example.com' })
    expect(external.register).toHaveBeenCalledWith(expect.objectContaining({ requestedUrl: 'www.example.com', gscPropertyUrl: 'sc-domain:example.com' }))
    expect(external.updateSiteTeam).not.toHaveBeenCalled()
    external.identity.mockResolvedValue({ identity: { siteId: 's_exact', requestedUrl: 'https://www.example.com', userId: 'u_owner', teamId: 't_owner' } })
    sqlite.prepare('UPDATE users SET gscdump_api_key = ? WHERE user_id = 1').run('user-key')
    const coverage = await request({
      route: proxy,
      method: 'GET',
      query: '?startDate=2026-10-01&endDate=2026-10-31&searchType=web',
    }, {}, { surface: 'partner', path: 'sites/s_exact/analytics/coverage' }) as Response
    expect(coverage.status).toBe(200)
    expect(external.relay).toHaveBeenCalledOnce()
  })

  it('binds a reusable engine registration before replacing the pointer', async () => {
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.register.mockResolvedValue({ _tag: 'Registered', registration: { siteId: 's_exact', existing: true } })
    external.updateSiteTeam.mockImplementationOnce(async () => {
      expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = ?').get('local')).toMatchObject({ gscdump_site_id: 's_engine' })
      return { data: { ok: true, teamId: 't_owner' } }
    })

    await expect(relink()).resolves.toMatchObject({ success: true, gscdumpSiteId: 's_exact' })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = ?').get('local')).toMatchObject({ gscdump_site_id: 's_exact' })
  })

  it('preserves the old pointer when the canonical Team cannot be resolved', async () => {
    external.createTeam.mockRejectedValueOnce(new Error('Team service unavailable'))

    await expect(relink()).rejects.toMatchObject({ statusCode: 503 })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = ?').get('local')).toMatchObject({ gscdump_site_id: 's_engine' })
    expect(external.register).not.toHaveBeenCalled()
  })

  it('preserves the old pointer when the owner changes Google accounts during registration', async () => {
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.register.mockImplementationOnce(async () => {
      sqlite.prepare('UPDATE users SET gscdump_user_id = ? WHERE user_id = 1').run('u_changed')
      return { _tag: 'Registered', registration: { siteId: 's_exact' } }
    })

    await expect(relink()).rejects.toMatchObject({ statusCode: 503 })
    expect(sqlite.prepare('SELECT gscdump_site_id FROM sites WHERE id = ?').get('local')).toMatchObject({ gscdump_site_id: 's_engine' })
  })

  it('does not repair a Shared Team as a Personal Team', async () => {
    sqlite.exec('UPDATE teams SET personal_team = 0 WHERE team_id = 1')
    external.caller.memberships[0]!.isPersonal = false
    external.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })

    await expect(relink()).resolves.toMatchObject({ success: true, gscdumpSiteId: 's_engine' })
    expect(external.createTeam).not.toHaveBeenCalled()
  })
})

describe('property association uses the local registered host', () => {
  it.each(['https://www.example.com', 'https://example.com'])('keeps populated property state bound to its requested host: %s', async (requestedUrl) => {
    sqlite.exec('UPDATE sites SET gscdump_site_id = NULL')
    sqlite.exec('UPDATE users SET gscdump_api_key = \'user-key\'')
    const progress = { completed: 30, total: 30, failed: 0, percent: 100 }
    external.available.mockResolvedValue({ sites: [{ siteUrl: 'sc-domain:example.com', siteId: 's_engine', registered: true, permissionLevel: 'siteOwner', syncStatus: 'synced', syncProgress: progress, lastSyncAt: 12345, oldestDateSynced: '2026-09-01', newestDateSynced: '2026-10-01' }] })
    external.lifecycle.mockResolvedValue({ account: { status: 'ready' }, sites: [{
      siteId: 's_engine',
      requestedUrl,
      gscPropertyUrl: 'sc-domain:example.com',
      permissionLevel: 'siteOwner',
      property: { status: 'registered' },
      analytics: { status: 'ready', queryable: true, progress, syncedRange: { oldest: '2026-09-01', newest: '2026-10-01' } },
      indexing: { status: 'ready', eligible: true, reason: null, progress: null },
      sitemaps: { status: 'ready' },
      latestError: null,
      updatedAt: '2026-10-01T00:00:00Z',
    }] })
    const result = await request({ route: properties, method: 'GET', query: '' }) as { properties: Array<Record<string, unknown>> }
    const local = result.properties.find(property => property.matchingSite != null)
    expect(local).toMatchObject(requestedUrl === 'https://example.com'
      ? { gscdumpSiteId: 's_engine', syncProgress: progress, oldestDateSynced: '2026-09-01', newestDateSynced: '2026-10-01' }
      : { gscdumpSiteId: null, syncStatus: null, syncProgress: null, lastSyncAt: null, oldestDateSynced: null, newestDateSynced: null })
    if (requestedUrl === 'https://www.example.com')
      expect(result.properties.some(property => property.matchingSite == null && property.gscdumpSiteId === 's_engine' && property.syncProgress === progress)).toBe(true)
  })
  it.each([{ requestedUrl: 'https://www.example.com', matched: true }, { requestedUrl: 'https://example.com', matched: false }])('keeps www distinct from its broad Domain property: $requestedUrl', async ({ requestedUrl, matched }) => {
    sqlite.exec('UPDATE sites SET domain = \'www.example.com\'')
    sqlite.exec('UPDATE users SET gscdump_api_key = \'user-key\'')
    external.lifecycle.mockResolvedValue({
      account: { status: 'ready' },
      sites: [{
        siteId: 's_engine',
        requestedUrl,
        gscPropertyUrl: 'sc-domain:example.com',
        permissionLevel: 'siteOwner',
        property: { status: 'registered' },
        analytics: { status: 'ready', queryable: true, progress: { completed: 30, total: 30, failed: 0, percent: 100 }, syncedRange: { oldest: null, newest: null } },
        indexing: { status: 'ready', eligible: true, reason: null, progress: null },
        sitemaps: { status: 'ready' },
        latestError: null,
        updatedAt: null,
      }],
    })
    const result = await request({ route: properties, method: 'GET', query: '' }) as { properties: Array<{ matchingSite: unknown }> }
    expect(result.properties.some(property => property.matchingSite != null)).toBe(matched)
  })
})

describe('real proxy registration ownership', () => {
  function relay() {
    sqlite.exec('UPDATE users SET gscdump_api_key = \'user-key\' WHERE user_id = 1')
    return request({ route: proxy, method: 'GET', query: '' }, {}, { surface: 'partner', path: 'sites/s_engine/indexing' })
  }
  it('accepts the current third-member registrant when owner lifecycle omits the Site', async () => {
    external.lifecycle.mockResolvedValue({ sites: [] })
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_third_member', teamId: 't_owner' } })
    await expect(relay()).resolves.toBeDefined()
    expect(external.relay).toHaveBeenCalledOnce()
    expect(external.lifecycle).not.toHaveBeenCalled()
  })
  it('preserves distinct creator proof without collapsing the owner SQL column', async () => {
    sqlite.exec('UPDATE sites SET owner_id = 2')
    sqlite.exec('DELETE FROM team_memberships')
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_third_member', teamId: 't_owner' } })
    await expect(relay()).resolves.toBeDefined()
    expect(external.relay).toHaveBeenCalledOnce()
  })
  it('refuses another account on the same host without relaying', async () => {
    external.identity.mockResolvedValue({ identity: { siteId: 's_engine', requestedUrl: 'https://example.com', userId: 'u_foreign', teamId: 't_foreign' } })
    await expect(relay()).rejects.toMatchObject({ statusCode: 403 })
    expect(external.relay).not.toHaveBeenCalled()
  })
})
