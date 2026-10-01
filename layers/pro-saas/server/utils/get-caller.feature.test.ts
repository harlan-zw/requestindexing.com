import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import type { D1DatabaseOptions } from '~~/tests/utils/pro-database'
import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdminEmail } from '~~/apps/admin/server/utils/admin'
import { d1Database, migratedSqlite, seedMembership, seedUser } from '~~/tests/utils/pro-database'
import { getCaller } from './get-caller'
import { requireCurrentTeam } from './require-current-team'

// Every signed-in page resolves the caller up to three times: `/api/pro/caller`,
// the roster and a Site read. D1 runs in WEUR, 110 to 300 ms from the Worker,
// so each round trip here is paid on every page.
const h = vi.hoisted(() => ({
  session: { user: { id: 2, email: 'user-2@example.test' } } as Record<string, unknown>,
  db: null as unknown,
  clearUserSession: vi.fn(),
}))

vi.mock('#domain-events/server', () => ({ dispatchEvent: vi.fn(async () => undefined) }))

vi.stubGlobal('createError', createError)
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('getRouterParam', () => undefined)
vi.stubGlobal('getUserSession', async () => h.session)
vi.stubGlobal('clearUserSession', h.clearUserSession)
vi.stubGlobal('isAdminEmail', isAdminEmail)

describe('getCaller', () => {
  let sqlite: DatabaseSync
  let roundTrips: string[]

  function useDatabase(options: Omit<D1DatabaseOptions, 'onRoundTrip'> = {}) {
    h.db = d1Database(sqlite, { ...options, onRoundTrip: kind => roundTrips.push(kind) })
  }

  function event(): H3Event {
    return { context: {} } as unknown as H3Event
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sqlite = migratedSqlite()
    roundTrips = []
    seedUser(sqlite, 1)
    seedUser(sqlite, 2)
    seedMembership(sqlite, 1, 2, 'editor')
    sqlite.prepare('UPDATE users SET current_team_id = 1 WHERE user_id = 2').run()
    sqlite.prepare('INSERT INTO user_identities (user_id, provider, provider_user_id, email, display_name) VALUES (2, \'google\', \'g-2\', \'two@example.test\', \'Two\')').run()
    useDatabase()
  })

  it('resolves the caller and its current team in one round trip', async () => {
    const ctx = await requireCurrentTeam(event())

    expect(ctx.caller).toMatchObject({ user: { id: 2, name: 'Two' }, currentTeamId: 1 })
    expect(ctx.caller.memberships.map(m => [m.teamId, m.role])).toEqual([[2, 'owner'], [1, 'editor']])
    expect(ctx.team).toMatchObject({ teamId: 1, name: 'team-1' })
    expect(ctx.role).toBe('editor')
    expect(roundTrips).toEqual(['batch'])
  })

  it('keeps the caller without display fields when the identity read fails', async () => {
    useDatabase({ failBatch: statements => statements.some(sql => sql.includes('"user_identities"')) })

    const caller = await getCaller(event())

    expect(caller).toMatchObject({ user: { id: 2, name: null, providers: [] }, currentTeamId: 1 })
  })

  it('signs out a session whose user row is gone', async () => {
    h.session = { user: { id: 99 } }

    expect(await getCaller(event())).toBeNull()
    expect(h.clearUserSession).toHaveBeenCalledOnce()
    h.session = { user: { id: 2, email: 'user-2@example.test' } }
  })

  it('fails the request but keeps the session when the database does not answer', async () => {
    useDatabase({ unavailable: true })

    await expect(getCaller(event())).rejects.toMatchObject({ statusCode: 503 })
    expect(h.clearUserSession).not.toHaveBeenCalled()
  })
})
