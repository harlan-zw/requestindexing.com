import type { DatabaseSync } from 'node:sqlite'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { drizzle } from 'drizzle-orm/d1'
import { createError, createEvent } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase } from '~~/tests/support/migrated-d1'

const fixture = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-origin', () => ({ createGscdumpPublicV1Client: () => ({ getUserIntegrationActivity: fixture.read }) }))
let sqlite: DatabaseSync
beforeEach(() => {
  sqlite = migratedDatabase()
  fixture.read.mockReset().mockResolvedValue({ data: { measuredAt: '2026-11-10T00:00:00.000Z', activities: [{ surface: 'cli', client: 'gscdump', label: 'CLI', configuredUsers: null, successfulUsers: 1, successfulCalls: 2, firstObservedAt: null, lastObservedAt: null, coverage: 'retained', note: 'Credential-bound observations only.' }] } })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getUserSession', async () => ({ user: { email: 'harlan@harlanzw.com' } }))
  vi.stubGlobal('createError', createError)
  const db = drizzle({
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql)
      const prepared = (params: unknown[] = []) => ({
        bind: (...values: unknown[]) => prepared(values),
        raw: async () => statement.all(...params as never[]).map(row => Object.values(row)),
      })
      return prepared()
    },
  } as unknown as D1Database)
  vi.stubGlobal('useDrizzle', vi.fn(() => db))
  sqlite.exec(`INSERT INTO teams (team_id, public_id, name, personal_team) VALUES (1, 't_fixture', 'Fixture', 1);
    INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, created_at, gscdump_api_key, gscdump_user_id)
    VALUES (1, 'u_fixture', 'Ada', 'ada@example.test', '', 1, 'google-1', 1, '2026-11-01 00:00:00', 'must-not-leak', 'u_engine');`)
})
afterEach(() => {
  sqlite.close()
  vi.unstubAllGlobals()
})
async function read(id = '1') {
  const handler = (await import('./integration-activity.get')).default
  const request = new IncomingMessage(new Socket())
  const event = createEvent(request, new ServerResponse(request))
  event.context.params = { id }
  return handler(event)
}
it('reads only the stored engine identity and preserves unknown measurements', async () => {
  const result = await read()
  expect(fixture.read).toHaveBeenCalledWith({ params: { userId: 'u_engine' } }, { signal: expect.any(AbortSignal) })
  expect(result).toMatchObject({ _tag: 'Available', measuredAt: '2026-11-10T00:00:00.000Z', activities: [{ configuredUsers: null, successfulCalls: 2 }] })
  expect(JSON.stringify(result)).not.toContain('must-not-leak')
})
it('refuses a non-admin before database or engine access', async () => {
  vi.stubGlobal('getUserSession', async () => ({ user: { email: 'agent@example.test' } }))
  await expect(read()).rejects.toMatchObject({ statusCode: 403 })
  expect(useDrizzle).not.toHaveBeenCalled()
  expect(fixture.read).not.toHaveBeenCalled()
})
it.each(['u_other', '0', '-1', '1.5', '9007199254740992'])('refuses invalid local identity %s before any read', async (id) => {
  await expect(read(id)).rejects.toMatchObject({ statusCode: 400 })
  expect(useDrizzle).not.toHaveBeenCalled()
  expect(fixture.read).not.toHaveBeenCalled()
})
it('keeps unlinked and missing accounts distinct without engine calls', async () => {
  sqlite.exec('UPDATE users SET gscdump_user_id = NULL WHERE user_id = 1')
  await expect(read()).resolves.toEqual({ _tag: 'Unlinked' })
  await expect(read('2')).rejects.toMatchObject({ statusCode: 404 })
  expect(fixture.read).not.toHaveBeenCalled()
})
