import type { H3Event } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedMembership, seedSite, seedUser } from './utils/pro-database'

// The session fetch hook publishes the current team's name and whether it has
// Sites. `users.current_team_id` is a remembered selection that can outlive a
// membership, so the hook must not publish a team the user no longer belongs to.
const h = vi.hoisted(() => ({
  db: null as unknown,
  fetch: null as null | ((session: Record<string, unknown>, event: H3Event) => Promise<void>),
}))

vi.mock('#layers/pro-gsc/server/utils/gscdump-account-status', () => ({
  readGscdumpAccountStatus: async () => null,
}))

vi.stubGlobal('defineNitroPlugin', (setup: () => void) => setup)
vi.stubGlobal('sessionHooks', {
  hook: (name: string, handler: typeof h.fetch) => {
    if (name === 'fetch')
      h.fetch = handler
  },
})
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('isAdminEmail', () => false)
vi.stubGlobal('clearUserSession', vi.fn())

// The plugin reads Nitro auto-imports at module load, so it loads after the stubs.
async function fetchSession(userId: number) {
  const { default: setup } = await import('../layers/pro-saas/server/plugins/session')
  ;(setup as unknown as () => void)()
  const session: Record<string, unknown> = { user: { id: userId } }
  await h.fetch!(session, { context: {} } as H3Event)
  return session
}

let sqlite: DatabaseSync

beforeEach(() => {
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  seedSite(sqlite, { id: 'site-1', teamId: 1, domain: 'one.example' })
})

describe('session fetch hook', () => {
  it('publishes the current team to a member', async () => {
    seedMembership(sqlite, 1, 2, 'viewer')
    sqlite.prepare('UPDATE users SET current_team_id = 1 WHERE user_id = 2').run()

    const session = await fetchSession(2)

    expect(session.team).toMatchObject({ teamId: 1, name: 'team-1' })
    expect(session.hasSites).toBe(true)
  })

  it('publishes no team to a user who left it', async () => {
    sqlite.prepare('UPDATE users SET current_team_id = 1 WHERE user_id = 2').run()

    const session = await fetchSession(2)

    expect(session.team).toBeNull()
    expect(session.hasSites).toBe(false)
  })
})
