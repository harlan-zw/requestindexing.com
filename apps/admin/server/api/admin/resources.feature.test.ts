import type { DatabaseSync } from 'node:sqlite'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'
import { createHooks } from 'hookable'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'

let sqlite: DatabaseSync
let routeKey: string
let query: Record<string, unknown>

beforeEach(() => {
  sqlite = migratedDatabase()
  routeKey = 'pro-feedback'
  query = {}
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getUserSession', vi.fn(async () => ({ user: { id: 1, email: 'harlan@harlanzw.com' } })))
  vi.stubGlobal('getRouterParam', () => routeKey)
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('useDrizzle', vi.fn(() => proDatabase(sqlite)))
  sqlite.exec(`INSERT INTO teams (team_id, public_id, name, personal_team) VALUES (1, 't_fixture', 'Fixture', 1);
    INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id)
    VALUES (7, 'u_seven', 'Ada', 'ada@example.test', '', 1, 'google-7', 1);
    INSERT INTO user_identities (user_id, provider, provider_user_id, email, display_name) VALUES (7, 'google', 'g-7', 'ada@example.test', 'Ada');
    INSERT INTO feedback (path, thumb, comment, metadata, user_id)
    VALUES ('/pro/dashboard', 'up', 'Show the sitemap age', '{"source":"dashboard-drawer","intent":"improvement","sentiment":"happy"}', 7);`)
})
afterEach(() => {
  sqlite.close()
  vi.unstubAllGlobals()
  vi.resetModules()
})

/** A Nitro app with the real pro-saas plugin listening on `admin:resources`. */
async function nitroAppWithResources() {
  const { requireAdminAuth } = await import('../../utils/admin')
  vi.stubGlobal('requireAdminAuth', requireAdminAuth)
  const nitroApp = { hooks: createHooks() }
  const plugin = (await import('~~/layers/pro-saas/server/plugins/admin-resources')).default as unknown as (app: typeof nitroApp) => void
  plugin(nitroApp)
  vi.stubGlobal('useNitroApp', () => nitroApp)
  return nitroApp
}

async function list() {
  await nitroAppWithResources()
  const handler = (await import('./resources/[key].get')).default as unknown as (event: ReturnType<typeof createEvent>) => Promise<{ rows: Array<Record<string, unknown>>, total: number, relations: { users: Record<string, { email: string }> } }>
  const request = new IncomingMessage(new Socket())
  return handler(createEvent(request, new ServerResponse(request)))
}

describe('admin resource route', () => {
  it('lists feedback reports for an admin through the pro-feedback resource', async () => {
    const result = await list()
    expect(result.total).toBe(1)
    expect(result.rows[0]).toMatchObject({ path: '/pro/dashboard', thumb: 'up', comment: 'Show the sitemap age', userId: 7, metadata: { intent: 'improvement' } })
    expect(result.relations.users['7']?.email).toBe('ada@example.test')
  })

  it('serves the feedback resource the same hook registered', async () => {
    routeKey = 'feedback'
    const result = await list()
    expect(result.rows.map(row => row.comment)).toEqual(['Show the sitemap age'])
  })

  it('refuses a non-admin before reading the database', async () => {
    vi.stubGlobal('getUserSession', vi.fn(async () => ({ user: { id: 7, email: 'ada@example.test' } })))
    await expect(list()).rejects.toMatchObject({ statusCode: 403 })
    expect(useDrizzle).not.toHaveBeenCalled()
  })

  it('refuses a signed-out request', async () => {
    vi.stubGlobal('getUserSession', vi.fn(async () => ({})))
    await expect(list()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('answers 404 for a resource no layer registered', async () => {
    routeKey = 'nope'
    await expect(list()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses a malformed page before reading the database', async () => {
    query = { page: '0' }
    await expect(list()).rejects.toMatchObject({ statusCode: 400 })
    expect(useDrizzle).not.toHaveBeenCalled()
  })
})
