import type { DatabaseSync } from 'node:sqlite'
import type { Caller } from '../layers/pro-saas/shared/caller'
import { createEvent, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser } from './utils/pro-database'

// The proxy proves an engine link against the authoritative registration
// before it relays. The registration lives under whoever ran the link
// (`link-gsc.post` hands the connecting member's grant in; the hourly
// reconcile runs under whoever reconciles), who is often neither the team
// owner nor the Site creator. The relay is sent with the caller's own stored
// credential, so the caller's own lifecycle is the last source that can hold
// the registration.
const h = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  getUserLifecycle: vi.fn(),
  consulted: [] as string[],
  upstreamFetch: vi.fn(async () => new Response('{}', { status: 200 })),
  db: null as unknown,
}))

vi.mock('#layers/pro-saas/server/utils/get-caller', () => ({
  getCaller: h.requireCaller,
  requireCaller: h.requireCaller,
}))

vi.mock('#layers/pro-gsc/server/utils/gscdump-client', () => ({
  useGscdumpClient: () => ({ getUserLifecycle: h.getUserLifecycle }),
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }))
vi.stubGlobal('fetch', h.upstreamFetch)

let sqlite: DatabaseSync

function callerOf(userId: number, teamId: number, role: 'admin' | 'editor' | 'viewer'): Caller {
  return {
    user: { id: userId, email: null, name: null, avatarUrl: null, providers: ['google'], createdAt: null },
    memberships: [{ teamId, teamName: `team-${teamId}`, role, isOwner: false, isPersonal: false, firstVisitDismissedAt: null }],
    currentTeamId: teamId,
    isAdmin: false,
  }
}

function proxyEvent(): ReturnType<typeof createEvent> {
  const event = createEvent(
    { method: 'GET', url: '/api/_gscdump/partner/v1/sites/s_gsd_a/indexing', headers: { host: 'app.example' }, connection: {} },
    { setHeader: () => undefined },
  )
  event.context.params = { surface: 'partner', path: 'sites/s_gsd_a/indexing' }
  return event
}

async function relay(): Promise<Response> {
  const { default: handler } = await import('../layers/pro-gsc/server/api/_gscdump/[surface]/v1/[...path]')
  const event = proxyEvent()
  return handler(event) as Promise<Response>
}

function lifecycleOf(principals: Record<string, { sites: { siteId: string, requestedUrl: string }[] }>): void {
  h.getUserLifecycle.mockImplementation(async (principalId: string) => {
    h.consulted.push(principalId)
    const found = principals[principalId]
    if (!found)
      throw new Error(`unexpected principal consulted: ${principalId}`)
    return found
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.consulted = []
  sqlite = migratedSqlite()
  // Drizzle maps rows positionally; `node:sqlite` answers with objects keyed
  // by result column name, and this proxy's joins read the same column off
  // two tables, which would collapse. Everything is arrays.
  const positional = sqlite.prepare.bind(sqlite)
  sqlite.prepare = (sql: string) => {
    const statement = positional(sql)
    statement.setReturnArrays(true)
    return statement
  }
  h.db = proDatabase(sqlite)
  // Team 1 owner (user 1) and Site creator (user 2) hold gscdump grants whose
  // lifecycles never hold this registration; user 3 linked the Site, and
  // `autoLinkGsc` registered `s_gsd_a` under user 3's grant.
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  seedUser(sqlite, 3)
  sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = ?').run('gd-owner', 'key_owner', 1)
  sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = ?').run('gd-creator', 'key_creator', 2)
  seedSite(sqlite, { id: 'site-a', teamId: 1, ownerId: 2, domain: 'a.example', gscdumpSiteId: 's_gsd_a' })
})

describe('the browser proxy over a registration held by the linking member', () => {
  it('relays once the caller whose lifecycle holds the registration is consulted', async () => {
    sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = ?').run('gd-linker', 'key_linker', 3)
    seedMembership(sqlite, 1, 3, 'editor')
    h.requireCaller.mockResolvedValue(callerOf(3, 1, 'editor'))
    lifecycleOf({
      'gd-owner': { sites: [] },
      'gd-creator': { sites: [] },
      'gd-linker': { sites: [{ siteId: 's_gsd_a', requestedUrl: 'https://a.example' }] },
    })

    const response = await relay()

    expect(response.status).toBe(200)
    expect(h.consulted).toContain('gd-linker')
    expect(h.upstreamFetch).toHaveBeenCalledTimes(1)
    const [upstreamUrl] = new URL(h.upstreamFetch.mock.calls[0]![0] as string).pathname.split('/v1/')
    expect(upstreamUrl.endsWith('/partner')).toBe(true)
    expect(h.upstreamFetch.mock.calls[0]![1]).toMatchObject({ headers: { authorization: 'Bearer key_linker' } })
  })
})

// The exact-host check this same probe added must still deny a stale link.
describe('the exact-host check stays intact', () => {
  it('refuses the relay when no consulted lifecycle holds the registration', async () => {
    sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = ?').run('gd-linker', 'key_linker', 3)
    seedMembership(sqlite, 1, 3, 'editor')
    h.requireCaller.mockResolvedValue(callerOf(3, 1, 'editor'))
    lifecycleOf({
      'gd-owner': { sites: [] },
      'gd-creator': { sites: [] },
      'gd-linker': { sites: [] },
    })

    await expect(relay()).rejects.toMatchObject({ statusCode: 503 })
    expect(h.upstreamFetch).not.toHaveBeenCalled()
  })

  it('refuses the relay when the registered host differs from the linked host', async () => {
    sqlite.prepare('UPDATE users SET gscdump_user_id = ?, gscdump_api_key = ? WHERE user_id = ?').run('gd-linker', 'key_linker', 3)
    seedMembership(sqlite, 1, 3, 'editor')
    h.requireCaller.mockResolvedValue(callerOf(3, 1, 'editor'))
    lifecycleOf({
      'gd-owner': { sites: [] },
      'gd-creator': { sites: [] },
      'gd-linker': { sites: [{ siteId: 's_gsd_a', requestedUrl: 'https://b.example' }] },
    })

    await expect(relay()).rejects.toMatchObject({ statusCode: 403 })
    expect(h.upstreamFetch).not.toHaveBeenCalled()
  })
})
