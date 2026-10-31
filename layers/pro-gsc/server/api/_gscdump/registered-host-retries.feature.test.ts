import { createEvent } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGscdumpClient } from '../../utils/gscdump-client'
import proxy from './[surface]/v1/[...path]'

vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (_options: unknown, handler: unknown) => handler }))

const state = {
  failure: 'always' as 'always' | 'first' | 'none',
  identityRequests: 0,
  relayRequests: 0,
}
const registration = {
  identity: { siteId: 's_engine', userId: 'u_owner', teamId: 't_owner', requestedUrl: 'https://example.com/', catalogSiteId: 1, warehouse: 'fixture', namespace: 'gsc', version: 0, revision: 0, catalogRevision: 1, dataVersion: 1 },
  coverage: { _tag: 'legacy' },
}

async function upstream(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.pathname.endsWith('/registered-host')) {
    state.identityRequests++
    if (state.failure === 'always' || (state.failure === 'first' && state.identityRequests === 1)) {
      return Response.json({ error: { code: 'rate_limited', message: 'Synthetic identity quota', requestId: 'req_fence_fixture', retryable: true, details: {} } }, { status: 429, headers: { 'retry-after': '0' } })
    }
    return Response.json({ data: registration, meta: { requestId: 'req_fence_fixture', surface: 'partner', version: '1.0' } })
  }
  state.relayRequests++
  return Response.json({ data: { fixture: 'admitted' } })
}

function request(method: 'GET' | 'POST') {
  const rows = [{ localSiteId: 'local', domain: 'example.com', property: 'sc-domain:example.com', owningTeamId: 1, linkedTeamId: null, upstreamTeamId: 't_owner', teamPrincipalId: 'u_owner', sitePrincipalId: 'u_owner' }]
  const db = {
    select: () => {
      const query = {
        from: () => query,
        leftJoin: () => query,
        innerJoin: () => query,
        where: () => query,
        get: async () => ({ apiKey: 'caller-key', userId: 'u_caller' }),
        all: async () => rows,
      }
      return query
    },
  }
  const path = method === 'GET' ? 'sites/s_engine/indexing' : 'sites/s_engine/sitemaps/submission'
  const event = createEvent({ url: `/api/_gscdump/partner/v1/${path}`, method, headers: { 'host': 'request.test', 'sec-fetch-site': 'same-origin' } } as never, {} as never)
  event.context.params = { surface: 'partner', path }
  const caller = { user: { id: 1 }, isAdmin: false, memberships: [{ teamId: 1, role: 'owner', isOwner: true }], currentTeamId: 1 }
  return (proxy as unknown as (context: unknown) => Promise<Response>)({ event, db, caller })
}

beforeEach(() => {
  Object.assign(state, { failure: 'always', identityRequests: 0, relayRequests: 0 })
  vi.stubGlobal('useRuntimeConfig', () => ({ public: {}, gscdump: { apiKey: 'partner-fixture', apiUrl: 'https://engine.test/api' } }))
  vi.stubGlobal('fetch', upstream)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['GET', 'POST'] as const)('refuses a throttled browser %s after one identity attempt without releasing data', async (method) => {
  await expect(request(method)).rejects.toMatchObject({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' })
  expect(state.identityRequests).toBe(1)
  expect(state.relayRequests).toBe(0)
})

it('relays an admitted browser read after one live identity answer', async () => {
  state.failure = 'none'
  const response = await request('GET')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ data: { fixture: 'admitted' } })
  expect(state.identityRequests).toBe(1)
  expect(state.relayRequests).toBe(1)
})

it('retains SDK retries for a server client without the interactive policy', async () => {
  state.failure = 'first'
  expect(await useGscdumpClient().getRegisteredHostIdentity('s_engine')).toEqual(registration)
  expect(state.identityRequests).toBe(2)
  expect(state.relayRequests).toBe(0)
})
