import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent, defineEventHandler } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { createPageTask } from '#layers/pro-saas/shared/page-task'
import { requirePageTaskSite } from './page-task-site'

const h = vi.hoisted(() => ({
  access: {} as Record<string, any>,
  session: {} as Record<string, any>,
  scope: vi.fn(),
  client: { getRegisteredHostIdentity: vi.fn(), getUserLifecycle: vi.fn(), listAvailableSites: vi.fn(), listSiteIndexingUrls: vi.fn(), inspectSiteUrls: vi.fn() },
}))
vi.mock('#layers/pro-saas/server/utils/require-site-access', () => ({ requireSiteAccess: async (_event: unknown, options?: { ability?: string }) => {
  if (options?.ability === 'write-data' && h.access.role === 'viewer')
    throw createError({ statusCode: 403 })
  return h.access
} }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ createGscdumpPublicV1Client: () => h.client }))
vi.mock('#layers/pro-gsc/server/utils/registered-site-scope', () => ({ assertLocalRegisteredGscSiteScope: h.scope }))
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (handler: unknown) => handler }))
vi.mock('#layers/pro-saas/server/utils/pro-events', () => ({ emitFirstProEvent: vi.fn(async () => true) }))
vi.mock('#layers/pro-saas/server/utils/caller-rows', () => ({ readCallerGscdumpUserId: async () => 'caller-principal' }))
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('useStorage', () => ({ getItem: async () => null }))
vi.stubGlobal('defineEventHandler', defineEventHandler)

function event(method: string, origin?: string, fetchSite?: string, url = 'https://www.example.com/Article'): H3Event {
  const request = new IncomingMessage(new Socket())
  request.method = method
  request.url = '/api/sites/site-a/onboarding/page'
  request.headers.host = 'requestindexing.com'
  request.headers['x-forwarded-proto'] = 'https'
  if (origin)
    request.headers.origin = origin
  if (fetchSite)
    request.headers['sec-fetch-site'] = fetchSite
  if (method === 'POST') {
    const body = JSON.stringify({ url })
    request.headers['content-type'] = 'application/json'
    request.headers['content-length'] = String(Buffer.byteLength(body))
    request.push(body)
    request.push(null)
  }
  return createEvent(request, new ServerResponse(request))
}

beforeEach(() => {
  vi.clearAllMocks()
  const created = createPageTask('https://www.example.com/Article', 7, Date.now(), 'task-a')
  if (created._tag !== 'Ok')
    throw new Error('Fixture is invalid')
  h.session = { user: { id: 7 }, secure: { pageTask: created.task } }
  h.access = { caller: { user: { id: 7 }, currentTeamId: 1 }, teamId: 1, site: { id: 'site-a', domain: 'www.example.com', property: 'https://www.example.com', gscdumpSiteId: 'engine-a' }, db: {}, role: 'owner' }
  h.scope.mockImplementation(async (_db, _local, engineId, readIdentity) => {
    await readIdentity(engineId)
    return { _tag: 'Registered' }
  })
  h.client.getRegisteredHostIdentity.mockResolvedValue({ data: { identity: { siteId: 'engine-a', requestedUrl: 'www.example.com', userId: 'site-principal', teamId: 'team-a' } } })
  h.client.getUserLifecycle.mockResolvedValue({ data: { sites: [{ siteId: 'engine-a', requestedUrl: 'www.example.com', gscPropertyUrl: 'sc-domain:example.com' }] } })
  h.client.listAvailableSites.mockResolvedValue({ data: { sites: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] } })
  h.client.listSiteIndexingUrls.mockResolvedValue({ data: { urls: [], pagination: { hasMore: false, offset: 0, limit: 100 } } })
  h.client.inspectSiteUrls.mockResolvedValue({ data: { results: [{ url: created.task.url, coverageState: 'Discovered - currently not indexed', verdict: 'NEUTRAL' }], errors: [], skipped: [] } })
})

it.each(['https://sibling.requestindexing.com', 'https://evil.test', undefined])('refuses an untrusted mutation Origin %s before inspection', async (origin) => {
  const { default: route } = await import('../api/sites/[siteId]/onboarding/page.post')
  await expect(route(event('POST', origin, 'same-site'))).rejects.toMatchObject({ statusCode: 403 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('reads an empty saved result without running a quota-backed inspection', async () => {
  const { default: route } = await import('../api/sites/[siteId]/onboarding/page.get')
  expect(await route(event('GET'))).toEqual({ _tag: 'Missing' })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
  expect(h.scope).toHaveBeenCalledWith(h.access.db, 'site-a', 'engine-a', expect.any(Function), 'https://www.example.com/Article')
})

it('checks the exact saved URL after explicit same-origin approval', async () => {
  const { default: route } = await import('../api/sites/[siteId]/onboarding/page.post')
  expect(await route(event('POST', 'https://requestindexing.com', 'same-origin'))).toMatchObject({ _tag: 'Evidence', evidence: { url: 'https://www.example.com/Article' } })
  expect(h.client.inspectSiteUrls).toHaveBeenCalledWith({ params: { siteId: 'engine-a' }, body: { urls: ['https://www.example.com/Article'] } })
})

it('rechecks current Team and exact host instead of trusting a previous Site choice', async () => {
  h.access.caller.currentTeamId = 2
  await expect(requirePageTaskSite(event('GET'))).rejects.toMatchObject({ statusCode: 404 })
  h.access.caller.currentTeamId = 1
  h.access.site.domain = 'example.com'
  await expect(requirePageTaskSite(event('GET'))).rejects.toMatchObject({ statusCode: 404 })
  expect(h.scope).not.toHaveBeenCalled()
})

it('lets viewers read, while refusing an inspection before the provider sees it', async () => {
  h.access.role = 'viewer'
  expect(await requirePageTaskSite(event('GET'))).toMatchObject({ role: 'viewer' })
  const { default: route } = await import('../api/sites/[siteId]/onboarding/page.post')
  await expect(route(event('POST', 'https://requestindexing.com'))).rejects.toMatchObject({ statusCode: 403 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('keeps an existing Site with an excluding URL prefix out of inspection and offers honest recovery', async () => {
  h.client.getUserLifecycle.mockResolvedValue({ data: { sites: [{ siteId: 'engine-a', requestedUrl: 'www.example.com', gscPropertyUrl: 'https://www.example.com/blog/' }] } })
  const { default: read } = await import('../api/sites/[siteId]/onboarding/page.get')
  const expected = { _tag: 'PropertyRequired', property: 'https://www.example.com/blog/', alternatives: ['sc-domain:example.com'] }
  expect(await read(event('GET'))).toEqual(expected)
  const { default: inspect } = await import('../api/sites/[siteId]/onboarding/page.post')
  expect(await inspect(event('POST', 'https://requestindexing.com'))).toEqual(expected)
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
  expect(h.client.listAvailableSites).toHaveBeenCalledWith({ params: { userId: 'caller-principal' }, query: {} })
})

it('does not mistake unavailable property proof for a missing saved inspection', async () => {
  h.client.getUserLifecycle.mockRejectedValue(new Error('lifecycle unavailable'))
  const { default: read } = await import('../api/sites/[siteId]/onboarding/page.get')
  await expect(read(event('GET'))).rejects.toThrow('lifecycle unavailable')
  expect(h.client.listSiteIndexingUrls).not.toHaveBeenCalled()
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('guards both task creation and page-view metrics against cross-origin mutations', async () => {
  const { default: createTask } = await import('#layers/pro-saas/server/api/onboarding/page.post')
  const { default: view } = await import('../api/sites/[siteId]/onboarding/page-view.post')
  await expect(createTask(event('POST', 'https://sibling.requestindexing.com', 'same-site'))).rejects.toMatchObject({ statusCode: 403 })
  await expect(view(event('POST', 'https://sibling.requestindexing.com', 'same-site'))).rejects.toMatchObject({ statusCode: 403 })
  expect(h.client.listSiteIndexingUrls).not.toHaveBeenCalled()
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('never spends quota on a newer page that replaced the URL still shown in another tab', async () => {
  const { default: inspect } = await import('../api/sites/[siteId]/onboarding/page.post')
  await expect(inspect(event('POST', 'https://requestindexing.com', 'same-origin', 'https://www.example.com/Older'))).rejects.toMatchObject({ statusCode: 409 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
  const { default: view } = await import('../api/sites/[siteId]/onboarding/page-view.post')
  expect(await view(event('POST', 'https://requestindexing.com', 'same-origin', 'https://www.example.com/Older'))).toEqual({ recorded: false })
  expect(h.client.listSiteIndexingUrls).not.toHaveBeenCalled()
})
