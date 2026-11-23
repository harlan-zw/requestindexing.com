import type { H3Event } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { createError, createEvent } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import savedRoute from '../api/sites/[siteId]/onboarding/first-report-saved.get'
import viewedRoute from '../api/sites/[siteId]/onboarding/first-report-view.post'
import previewRoute from '../api/sites/[siteId]/onboarding/first-report.get'
import inspectRoute from '../api/sites/[siteId]/onboarding/first-report.post'

const h = vi.hoisted(() => ({
  access: {} as Record<string, any>,
  scope: vi.fn(),
  createClient: vi.fn(),
  event: vi.fn(async () => true),
  client: { getRegisteredHostIdentity: vi.fn(), getUserLifecycle: vi.fn(), listSitemapUrls: vi.fn(), listSiteIndexingUrls: vi.fn(), inspectSiteUrls: vi.fn() },
}))
vi.mock('#layers/pro-saas/server/utils/require-site-access', () => ({ requireSiteAccess: async (_event: unknown, options?: { ability?: string }) => {
  if (options?.ability === 'write-data' && h.access.role === 'viewer')
    throw createError({ statusCode: 403 })
  return h.access
} }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ createGscdumpPublicV1Client: (...args: unknown[]) => {
  h.createClient(...args)
  return h.client
} }))
vi.mock('#layers/pro-gsc/server/utils/registered-site-scope', () => ({ assertLocalRegisteredGscSiteScope: h.scope }))
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (handler: unknown) => handler }))
vi.mock('#layers/pro-saas/server/utils/pro-events', () => ({ emitFirstProEvent: h.event }))
vi.stubGlobal('useRuntimeConfig', () => ({ session: { password: 'test-secret-'.repeat(4) } }))

function event(method: string, body?: unknown, origin = 'https://requestindexing.com'): H3Event {
  const request = new IncomingMessage(new Socket())
  request.method = method
  request.url = '/api/sites/site-a/onboarding/first-report'
  request.headers = { 'host': 'requestindexing.com', 'x-forwarded-proto': 'https', origin }
  if (body) {
    const json = JSON.stringify(body)
    request.headers['content-type'] = 'application/json'
    request.headers['content-length'] = String(Buffer.byteLength(json))
    request.push(json)
    request.push(null)
  }
  return createEvent(request, new ServerResponse(request))
}

beforeEach(() => {
  vi.clearAllMocks()
  h.access = { caller: { user: { id: 7 }, currentTeamId: 1 }, teamId: 1, site: { id: 'site-a', domain: 'example.com', property: 'https://example.com/docs/', gscdumpSiteId: 'engine-a' }, db: {}, role: 'admin', isOwner: true }
  h.scope.mockImplementation(async (_db, _local, engineId, readIdentity) => {
    await readIdentity(engineId)
  })
  h.client.getRegisteredHostIdentity.mockResolvedValue({ data: { identity: { siteId: 'engine-a', requestedUrl: 'example.com', userId: 'principal-a', teamId: 'team-a' } } })
  h.client.getUserLifecycle.mockResolvedValue({ data: { sites: [{ siteId: 'engine-a', gscPropertyUrl: 'https://example.com/docs/' }] } })
  h.client.listSitemapUrls.mockResolvedValue({ data: { generation: { id: 'g1', observedAt: Date.now() }, items: [{ url: 'https://example.com/docs/a' }, { url: 'https://www.example.com/docs/b' }, { url: 'https://example.com/other' }], page: { nextCursor: null } } })
  h.client.inspectSiteUrls.mockResolvedValue({ data: { results: [{ url: 'https://example.com/docs/a', coverageState: 'Discovered - currently not indexed', verdict: 'NEUTRAL' }], errors: [], skipped: [] } })
  h.client.listSiteIndexingUrls.mockResolvedValue({ data: { urls: [{ url: 'https://example.com/docs/a', coverageState: null, verdict: null, lastCheckedAt: new Date().toISOString() }], pagination: { hasMore: false } } })
})

async function preview() {
  const value = await previewRoute(event('GET'))
  if (value._tag !== 'Ready')
    throw new Error('Preview fixture is invalid.')
  return value
}

it('previews known scoped URLs without spending inspection quota', async () => {
  expect(await preview()).toMatchObject({ urls: ['https://example.com/docs/a'], canInspect: true })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('previews a Site with no published Sitemap as empty', async () => {
  h.client.listSitemapUrls.mockRejectedValue(new GscdumpV1Error({ code: 'invalid_request', message: 'No published sitemap generation', status: 400, retryable: false, details: { reason: 'no_generation' } }))
  expect(await previewRoute(event('GET'))).toEqual({ _tag: 'Empty' })
})

it('refuses Inspect as changed when the Sitemap is no longer published', async () => {
  const plan = await preview()
  h.client.listSitemapUrls.mockRejectedValue(new GscdumpV1Error({ code: 'invalid_request', message: 'No published sitemap generation', status: 400, retryable: false, details: { reason: 'no_generation' } }))
  await expect(inspectRoute(event('POST', { token: plan.token }))).rejects.toMatchObject({ statusCode: 409 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('keeps other Sitemap refusals as failed loads', async () => {
  const refusal = new GscdumpV1Error({ code: 'invalid_request', message: 'Invalid sitemap URL page: cursor', status: 400, retryable: false, details: {} })
  h.client.listSitemapUrls.mockRejectedValue(refusal)
  await expect(previewRoute(event('GET'))).rejects.toBe(refusal)
})

it('runs only the reviewed URLs after an explicit authorized request', async () => {
  const plan = await preview()
  expect(await inspectRoute(event('POST', { token: plan.token }))).toMatchObject({ _tag: 'Results', rows: [{ _tag: 'Evidence', evidence: { url: plan.urls[0] } }] })
  expect(h.client.inspectSiteUrls).toHaveBeenCalledExactlyOnceWith({ params: { siteId: 'engine-a' }, body: { urls: plan.urls } })
  expect(h.createClient).toHaveBeenLastCalledWith(expect.anything(), { attempts: 1 })
  expect(h.client.listSitemapUrls).toHaveBeenLastCalledWith({ params: { siteId: 'engine-a' }, query: { generationId: 'g1', cursor: undefined, limit: 100 } })
})

it.each(['Team', 'user', 'property', 'membership', 'signature'] as const)('refuses a changed %s before spending quota', async (change) => {
  const plan = await preview()
  if (change === 'Team')
    h.access.caller.currentTeamId = 2
  if (change === 'user')
    h.access.caller.user.id = 8
  if (change === 'property')
    h.client.getUserLifecycle.mockResolvedValue({ data: { sites: [{ siteId: 'engine-a', gscPropertyUrl: 'https://example.com/other/' }] } })
  if (change === 'membership')
    h.client.listSitemapUrls.mockResolvedValue({ data: { generation: { id: 'g1', observedAt: Date.now() }, items: [], page: { nextCursor: null } } })
  const token = change === 'signature' ? `${plan.token.slice(0, -5)}AAAAA` : plan.token
  await expect(inspectRoute(event('POST', { token }))).rejects.toMatchObject({ statusCode: change === 'Team' ? 404 : 409 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('rejects viewers and cross-origin actions before inspection', async () => {
  const plan = await preview()
  h.access.role = 'viewer'
  await expect(inspectRoute(event('POST', { token: plan.token }))).rejects.toMatchObject({ statusCode: 403 })
  h.access.role = 'admin'
  await expect(inspectRoute(event('POST', { token: plan.token }, 'https://sibling.requestindexing.com'))).rejects.toMatchObject({ statusCode: 403 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('rejects malformed plans as client input before spending quota', async () => {
  await expect(inspectRoute(event('POST', { token: 123 }))).rejects.toMatchObject({ statusCode: 400 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('does not replay an inspection with an unknown network outcome', async () => {
  const plan = await preview()
  h.client.inspectSiteUrls.mockRejectedValueOnce(new Error('connection closed'))
  expect(await inspectRoute(event('POST', { token: plan.token }))).toEqual({ _tag: 'Uncertain' })
  expect(h.client.inspectSiteUrls).toHaveBeenCalledOnce()
})

it('keeps metadata-only rows out of actual evidence viewing metrics', async () => {
  const plan = await preview()
  expect(await viewedRoute(event('POST', { token: plan.token }))).toEqual({ recorded: false })
  expect(h.event).not.toHaveBeenCalled()
  h.client.listSiteIndexingUrls.mockResolvedValue({ data: { urls: [{ url: plan.urls[0], coverageState: 'Crawled - currently not indexed', lastCheckedAt: new Date().toISOString() }], pagination: { hasMore: false } } })
  expect(await viewedRoute(event('POST', { token: plan.token }))).toEqual({ recorded: true })
  expect(h.event).toHaveBeenCalledExactlyOnceWith(h.access.db, 7, 'first_report_evidence_viewed', { siteId: 'site-a', count: 1, source: 'inspection' })
})

const savedRows = [
  { url: 'https://example.com/docs/a', coverageState: 'Crawled - currently not indexed', verdict: 'NEUTRAL', lastCheckedAt: '2026-11-24T06:12:00Z' },
  { url: 'https://example.com/other', coverageState: 'Submitted and indexed', verdict: 'PASS', lastCheckedAt: '2026-11-24T06:11:00Z' },
]

async function savedReport() {
  h.client.listSiteIndexingUrls.mockResolvedValue({ data: { urls: savedRows, pagination: { hasMore: false } } })
  const report = await savedRoute(event('GET'))
  if (report._tag !== 'Verdicts')
    throw new Error('Saved report fixture is invalid.')
  return report
}

it('opens on saved Google verdicts inside the property, without spending quota', async () => {
  const report = await savedReport()
  expect(report.rows).toEqual([expect.objectContaining({ url: 'https://example.com/docs/a', coverage: 'Crawled - currently not indexed', capturedAt: '2026-11-24T06:12:00Z' })])
  expect(h.client.listSiteIndexingUrls).toHaveBeenCalledWith(expect.objectContaining({ params: { siteId: 'engine-a' } }))
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('shows the engine URL Inspection phase when a new Site has no saved verdict', async () => {
  h.client.getUserLifecycle.mockResolvedValue({ data: { sites: [{ siteId: 'engine-a', gscPropertyUrl: 'https://example.com/docs/', indexing: { status: 'checking', reason: null } }] } })
  h.client.listSiteIndexingUrls.mockResolvedValue({ data: { urls: [], pagination: { hasMore: false } } })
  expect(await savedRoute(event('GET'))).toEqual({ _tag: 'Collecting', phase: 'checking' })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('never starts a URL Inspection from a saved-verdict plan', async () => {
  const report = await savedReport()
  await expect(inspectRoute(event('POST', { token: report.token }))).rejects.toMatchObject({ statusCode: 409 })
  expect(h.client.inspectSiteUrls).not.toHaveBeenCalled()
})

it('records a saved-verdict view from its signed plan without a second read', async () => {
  const report = await savedReport()
  h.client.listSiteIndexingUrls.mockClear()
  expect(await viewedRoute(event('POST', { token: report.token }))).toEqual({ recorded: true })
  expect(h.event).toHaveBeenCalledExactlyOnceWith(h.access.db, 7, 'first_report_evidence_viewed', { siteId: 'site-a', count: 1, source: 'saved' })
  expect(h.client.listSiteIndexingUrls).not.toHaveBeenCalled()
})
