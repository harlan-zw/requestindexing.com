import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_PARTNER_TIMEOUT_MS } from '../layers/pro-gsc/server/utils/gscdump-client'
import grant from '../layers/pro-indexing/server/api/sites/[siteId]/indexing/google-grant.get'
import submit from '../layers/pro-indexing/server/api/sites/[siteId]/indexing/google-submissions.post'

vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (handler: unknown) => handler }))
// Keep the production body validator, replacing only request-stream I/O while
// fake timers control the SDK transport and its authorization deadline.
vi.mock('h3', async original => ({
  ...await original<typeof import('h3')>(),
  readValidatedBody: async (_event: unknown, validate: (value: unknown) => unknown) => validate({ url: 'https://example.com/page', idempotencyKey: 'fixture-submission' }),
}))

let identityDelay = 3000
let requestedUrl = 'https://example.com'
let owner = 'u_owner'
let team = 't_owner'
let started: () => void
const downstream = vi.fn()
const requireSite = vi.fn()

const db = {
  select: () => {
    const query = {
      from: () => query,
      leftJoin: () => query,
      innerJoin: () => query,
      where: () => query,
      get: async () => ({ localSiteId: 'local', upstreamSiteId: 's_engine', domain: 'example.com', property: 'sc-domain:example.com', teamId: 1, upstreamTeamId: 't_owner', teamPrincipalId: 'u_owner', sitePrincipalId: 'u_owner' }),
      all: async () => [{ principalId: 'u_owner' }],
    }
    return query
  },
}

function json(data: unknown) {
  return new Response(JSON.stringify({ data, meta: { requestId: 'req_google_deadline', surface: 'partner', version: '1.0' } }), { headers: { 'content-type': 'application/json' } })
}

function visit(kind: 'grant' | 'submit') {
  const req = new IncomingMessage(new Socket())
  req.method = kind === 'grant' ? 'GET' : 'POST'
  req.url = `/api/sites/local/indexing/google-${kind}`
  const event = createEvent(req, new ServerResponse(req))
  return kind === 'grant' ? grant(event) : submit(event)
}

beforeEach(() => {
  identityDelay = 3000
  requestedUrl = 'https://example.com'
  owner = 'u_owner'
  team = 't_owner'
  downstream.mockClear()
  requireSite.mockReset().mockResolvedValue({ db, site: { id: 'local', gscdumpSiteId: 's_engine' } })
  vi.stubGlobal('requireTeamSite', requireSite)
  vi.stubGlobal('useRuntimeConfig', () => ({ gscdump: { apiKey: 'gsd_fixture', apiUrl: 'https://engine.test/api' }, googleIndexing: { clientId: 'fixture', clientSecret: 'fixture' } }))
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('Deadline expired', 'TimeoutError')), ms)
    return controller.signal
  })
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
    if (String(url).includes('registered-host')) {
      return new Promise<Response>((resolve, reject) => {
        started()
        const timer = setTimeout(() => resolve(json({
          identity: { siteId: 's_engine', userId: owner, teamId: team, requestedUrl, catalogSiteId: 1, warehouse: 'fixture', namespace: 'fixture', version: 1, revision: 1, catalogRevision: 1, dataVersion: 1 },
          coverage: { _tag: 'legacy' },
        })), identityDelay)
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(init.signal?.reason)
        }, { once: true })
      })
    }
    downstream(String(url), init)
    return Promise.resolve(init.method === 'POST'
      ? json({ submissionReceipt: { _tag: 'accepted', httpStatus: 200, reason: null, id: 'fixture', url: 'https://example.com/page', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', attempts: 1 } })
      : json({ _tag: 'missing' }))
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function observedVisit(kind: 'grant' | 'submit', advance: number) {
  const begun = new Promise<void>((resolve) => {
    started = resolve
  })
  const result = visit(kind).then(value => ({ value }), (error: unknown) => ({ error }))
  await begun
  await vi.advanceTimersByTimeAsync(advance)
  return result
}

it.each(['grant', 'submit'] as const)('%s waits for mandatory identity proof beyond 2.5 seconds', async (kind) => {
  expect(await observedVisit(kind, 3000)).toHaveProperty('value')
  expect(downstream).toHaveBeenCalledOnce()
  if (kind === 'submit')
    expect(requireSite).toHaveBeenCalledWith(expect.anything(), { ability: 'write-data' })
})

it.each(['grant', 'submit'] as const)('%s stays bounded and fails closed without a grant read or submission', async (kind) => {
  identityDelay = DEFAULT_PARTNER_TIMEOUT_MS + 1
  expect(await observedVisit(kind, DEFAULT_PARTNER_TIMEOUT_MS)).toMatchObject({ error: { statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' } })
  expect(downstream).not.toHaveBeenCalled()
})

it.each(['grant', 'submit'] as const)('%s still rejects another host, principal or Team before downstream work', async (kind) => {
  for (const mismatch of ['host', 'principal', 'team']) {
    requestedUrl = mismatch === 'host' ? 'https://www.example.com' : 'https://example.com'
    owner = mismatch === 'principal' ? 'u_other' : 'u_owner'
    team = mismatch === 'team' ? 't_other' : 't_owner'
    expect(await observedVisit(kind, 3000)).toMatchObject({ error: { statusCode: 403 } })
  }
  expect(downstream).not.toHaveBeenCalled()
})
