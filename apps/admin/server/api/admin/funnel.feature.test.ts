import type { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/d1'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase } from '~~/tests/support/migrated-d1'

let sqlite: DatabaseSync
let query: Record<string, unknown>

beforeEach(() => {
  sqlite = migratedDatabase()
  query = { from: '2026-10-01', to: '2026-10-07' }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getUserSession', vi.fn(async () => ({ user: { email: 'harlan@harlanzw.com' } })))
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('createError', createError)
  // D1 returns named rows for raw SQL; the shared sqlite-proxy fixture returns positional rows.
  const db = drizzle({
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql)
      const prepared = (params: unknown[] = []) => ({
        bind: (...values: unknown[]) => prepared(values),
        all: async () => ({ results: statement.all(...params as never[]) }),
      })
      return prepared()
    },
  } as unknown as D1Database)
  vi.stubGlobal('useDrizzle', vi.fn(() => db))
  sqlite.exec(`INSERT INTO teams (team_id, public_id, name, personal_team) VALUES (1, 't_fixture', 'Fixture', 1);
    INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, created_at, gscdump_api_key)
    VALUES (1, 'u_fixture', 'Ada', 'ada@example.test', '', 1, 'google-1', 1, '2026-04-22 15:13:53', 'must-not-leak');`)
})
afterEach(() => {
  sqlite.close()
  vi.unstubAllGlobals()
})

async function read() {
  const handler = (await import('./funnel.get')).default
  return handler({} as never)
}

describe('admin funnel endpoint', () => {
  it('counts duplicate milestones once, uses signup evidence over import dates, and includes later progress', async () => {
    const insert = sqlite.prepare('INSERT INTO pro_events (user_id, type, created_at) VALUES (1, ?, ?)')
    insert.run('signed_up', Date.parse('2026-10-01T12:00:00Z'))
    insert.run('signed_up', Date.parse('2026-10-02T12:00:00Z'))
    for (const type of ['gsc_connected', 'site_added', 'onboarding_completed']) {
      insert.run(type, Date.parse('2026-10-12T12:00:00Z'))
      insert.run(type, Date.parse('2026-10-13T12:00:00Z'))
    }
    const result = await read()
    expect(result.total).toBe(1)
    expect(result.stages.map(step => step.count)).toEqual([1, 1, 1, 1])
    expect(result.users[0]?.signedUpAt).toBe('2026-10-01T12:00:00.000Z')
    expect(result.accountDateFallbacks).toBe(0)
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })

  it('labels legacy dates and does not invent missing Google/Site events from a credential', async () => {
    query = { from: '2026-04-22', to: '2026-04-22' }
    const result = await read()
    expect(result.total).toBe(1)
    expect(result.accountDateFallbacks).toBe(1)
    expect(result.stages.map(step => step.count)).toEqual([1, 0, 0, 0])
  })

  it('rejects a non-admin before reading the database', async () => {
    vi.stubGlobal('getUserSession', async () => ({ user: { email: 'someone@example.test' } }))
    await expect(read()).rejects.toMatchObject({ statusCode: 403 })
    expect(useDrizzle).not.toHaveBeenCalled()
  })

  it('rejects invalid dates before reading the database', async () => {
    query.from = '2026-02-30'
    await expect(read()).rejects.toMatchObject({ statusCode: 400 })
    expect(useDrizzle).not.toHaveBeenCalled()
  })
})
