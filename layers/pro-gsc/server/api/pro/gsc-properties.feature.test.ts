import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { createError, defineEventHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdminEmail } from '~~/apps/admin/server/utils/admin'
import { d1Database, migratedSqlite, seedUser } from '~~/tests/utils/pro-database'

// The 2026-10-01 replay: Connect a Site read the property list for 4.0 to
// 6.2 s per request. The route waited on the gscdump lifecycle (0.9 to 1.4 s),
// then on the property list (about 1.6 s), with two D1 reads before both.

const h = vi.hoisted(() => ({
  session: { user: { id: 2, email: 'user-2@example.test' } } as Record<string, unknown>,
  db: null as unknown,
  client: null as unknown,
}))

vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-client', async importOriginal => ({
  ...await importOriginal<typeof import('#layers/pro-gsc/server/utils/gscdump-client')>(),
  useGscdumpClient: () => h.client,
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('getRouterParam', () => undefined)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('clearUserSession', vi.fn())
vi.stubGlobal('isAdminEmail', isAdminEmail)

function lifecycle(status: string) {
  return { account: { status }, sites: [] }
}

function event(): H3Event {
  return { context: {}, path: '/api/pro/gsc-properties' } as unknown as H3Event
}

describe('gET /api/pro/gsc-properties', () => {
  let sqlite: DatabaseSync
  let roundTrips: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    sqlite = migratedSqlite()
    roundTrips = []
    seedUser(sqlite, 2)
    sqlite.prepare('UPDATE users SET gscdump_user_id = \'u_agent\', gscdump_api_key = \'key\' WHERE user_id = 2').run()
    h.db = d1Database(sqlite, { onRoundTrip: kind => roundTrips.push(kind) })
  })

  it('asks gscdump for the lifecycle and the property list at once', async () => {
    let lifecycleAnswered = false
    let listAskedFirst = false
    h.client = {
      getUserLifecycle: () => new Promise(resolve => setTimeout(() => {
        lifecycleAnswered = true
        resolve(lifecycle('ready'))
      }, 5)),
      getAvailableSites: async () => {
        listAskedFirst = !lifecycleAnswered
        return { sites: [] }
      },
    }
    const { default: properties } = await import('./gsc-properties.get')

    const response = await properties(event())

    expect(listAskedFirst).toBe(true)
    expect(response).toMatchObject({ connected: true, properties: [] })
    expect(response.error).toBeUndefined()
  })

  it('reads D1 once after the caller, for the Team\'s Sites', async () => {
    h.client = {
      getUserLifecycle: async () => lifecycle('ready'),
      getAvailableSites: async () => ({ sites: [] }),
    }
    const { default: properties } = await import('./gsc-properties.get')

    await properties(event())

    expect(roundTrips).toEqual(['batch', 'statement'])
  })

  it('answers with the account error when the lifecycle has one, whatever the list says', async () => {
    h.client = {
      getUserLifecycle: async () => lifecycle('scope_missing'),
      getAvailableSites: async () => ({ sites: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] }),
    }
    const { default: properties } = await import('./gsc-properties.get')

    const response = await properties(event())

    expect(response).toMatchObject({ connected: true, properties: [], error: { reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' } })
  })
})
