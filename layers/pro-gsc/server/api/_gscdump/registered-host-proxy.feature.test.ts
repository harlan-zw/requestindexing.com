import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import proxy from './[surface]/v1/[...path]'

const state = vi.hoisted(() => ({
  rows: [{ localSiteId: 'local', domain: 'example.com', property: 'sc-domain:example.com', owningTeamId: 1, linkedTeamId: null as number | null, upstreamTeamId: null as string | null, teamPrincipalId: 'u_owner', sitePrincipalId: 'u_owner' }],
  lifecycle: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (_options: unknown, handler: unknown) => handler }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ getGscdumpApiUrl: () => 'https://engine.test/api' }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({ useGscdumpClient: () => ({ getRegisteredHostIdentity: async (siteId: string) => {
  const lifecycle = await state.lifecycle(siteId)
  const matches = lifecycle.sites.filter((site: { siteId: string }) => site.siteId === siteId)
  if (matches.length !== 1)
    throw new Error('identity unavailable')
  return { identity: { ...matches[0], userId: 'u_owner', teamId: 't_owner' } }
} }) }))

function request() {
  const db = {
    select: () => {
      const query = {
        from: () => query,
        leftJoin: () => query,
        innerJoin: () => query,
        where: () => query,
        get: async () => ({ apiKey: 'caller-key', userId: 'u_caller' }),
        all: async () => state.rows,
      }
      return query
    },
  }
  const event = createEvent({ url: '/api/_gscdump/partner/v1/sites/s_engine/indexing', method: 'GET', headers: { host: 'request.test' } } as never, {} as never)
  event.context.params = { surface: 'partner', path: 'sites/s_engine/indexing' }
  const caller = { user: { id: 1 }, isAdmin: false, memberships: [{ teamId: 1, role: 'viewer' }], currentTeamId: 1 }
  return (proxy as unknown as (context: unknown) => Promise<Response>)({ event, db, caller })
}

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }))
  vi.stubGlobal('fetch', state.fetch)
  state.fetch.mockReset().mockResolvedValue(new Response('{"ok":true}'))
  state.lifecycle.mockReset()
  state.rows = [{ localSiteId: 'local', domain: 'example.com', property: 'sc-domain:example.com', owningTeamId: 1, linkedTeamId: null, upstreamTeamId: null, teamPrincipalId: 'u_owner', sitePrincipalId: 'u_owner' }]
})

describe('browser proxy admits only the registered host', () => {
  it('does not union account proof across unrelated visible local Sites', async () => {
    state.rows.push({ ...state.rows[0]!, localSiteId: 'other-local', owningTeamId: 2, linkedTeamId: 1, teamPrincipalId: 'u_other', sitePrincipalId: 'u_other', upstreamTeamId: null })
    state.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    await expect(request()).rejects.toMatchObject({ statusCode: 403 })
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('refuses evidence from a different registered host before relaying', async () => {
    state.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://other.example.com' }] })
    await expect(request()).rejects.toMatchObject({ statusCode: 403 })
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('relays the exact host using the caller credential and owner lifecycle', async () => {
    state.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com/path' }] })
    expect((await request()).status).toBe(200)
    expect(state.lifecycle).toHaveBeenCalledExactlyOnceWith('s_engine')
    expect(state.fetch).toHaveBeenCalledWith(new URL('https://engine.test/api/partner/v1/sites/s_engine/indexing'), expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer caller-key' }),
    }))
  })

  it.each([
    ['missing registration', []],
    ['another Site', [{ siteId: 's_other', requestedUrl: 'https://example.com' }]],
    ['ambiguous registration', [{ siteId: 's_engine', requestedUrl: 'https://example.com' }, { siteId: 's_engine', requestedUrl: 'https://other.test' }]],
    ['invalid registration', [{ siteId: 's_engine', requestedUrl: 'https://user:pass@example.com' }]],
  ])('refuses %s without relaying', async (_label, sites) => {
    state.lifecycle.mockResolvedValue({ sites })
    await expect(request()).rejects.toMatchObject({ statusCode: 503 })
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('refuses an unavailable lifecycle without relaying', async () => {
    state.lifecycle.mockRejectedValue(new Error('provider timeout'))
    await expect(request()).rejects.toMatchObject({ statusCode: 503 })
    expect(state.fetch).not.toHaveBeenCalled()
  })

  it('ignores another Team mirror that the caller cannot read', async () => {
    state.rows.push({ ...state.rows[0]!, localSiteId: 'hidden', domain: 'other.test', owningTeamId: 2, teamPrincipalId: 'u_other', sitePrincipalId: 'u_other' })
    state.lifecycle.mockResolvedValue({ sites: [{ siteId: 's_engine', requestedUrl: 'https://example.com' }] })
    expect((await request()).status).toBe(200)
    expect(state.lifecycle).toHaveBeenCalledExactlyOnceWith('s_engine')
  })

  it('refuses a mirror with no principal to establish scope', async () => {
    state.rows[0]!.teamPrincipalId = ''
    state.rows[0]!.sitePrincipalId = ''
    await expect(request()).rejects.toMatchObject({ statusCode: 503 })
    expect(state.fetch).not.toHaveBeenCalled()
  })
})
