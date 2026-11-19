import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import complete from './complete.post'

// Finishing setup with no Site needs a Google grant that works. A stored
// gscdump key alone does not prove it: a reader who unticked Search Console
// keeps the key from an earlier grant, and only gscdump knows.

interface Context { event: H3Event, db: ReturnType<typeof useDrizzle>, caller: { user: { id: number } }, team: { team: { teamId: number } }, body: unknown }
const h = vi.hoisted(() => ({ status: vi.fn(), forget: vi.fn(async () => undefined), dispatch: vi.fn(async () => undefined) }))
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (options: { body: ZodType }, handle: (context: Context) => unknown) => (context: Context) => handle({ ...context, body: options.body.parse(context.body) }) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-account-status', () => ({ readGscdumpAccountStatus: h.status, forgetGscdumpAccountStatus: h.forget }))
vi.mock('#domain-events/server', () => ({ dispatchEvent: h.dispatch }))

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite)
  h.status.mockReset()
  h.forget.mockClear()
  vi.stubGlobal('setUserSession', async () => undefined)
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, gscdump_user_id, gscdump_api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(7, 'user-7', 'Test', '7@example.test', '', Date.now(), 'sub-7', 1, 'u_7', 'gsd_key')
})
afterEach(() => sqlite.close())

const finish = (body: unknown) => (complete as unknown as (context: Context) => Promise<unknown>)({ event: {} as H3Event, db: db as unknown as ReturnType<typeof useDrizzle>, caller: { user: { id: 7 } }, team: { team: { teamId: 1 } }, body })
const completedAt = () => (sqlite.prepare('SELECT onboarding_completed_at AS at FROM users WHERE user_id = 7').get() as { at: unknown }).at

it('refuses the Sites skip when gscdump reports the stored grant has no Search Console scope', async () => {
  h.status.mockResolvedValue('scope_missing')
  await expect(finish({ skipSites: true })).rejects.toMatchObject({ message: 'Connect Google Search Console before you finish setup.' })
  expect(completedAt()).toBeNull()
})

it('finishes with the Sites skip when the stored grant is ready', async () => {
  h.status.mockResolvedValue('ready')
  await finish({ skipSites: true })
  expect(completedAt()).not.toBeNull()
})

it('refuses the Sites skip with no stored engine key at all', async () => {
  sqlite.prepare('UPDATE users SET gscdump_user_id = NULL, gscdump_api_key = NULL WHERE user_id = 7').run()
  await expect(finish({ skipSites: true })).rejects.toMatchObject({ message: 'Connect Google Search Console before you finish setup.' })
  expect(h.status).not.toHaveBeenCalled()
})

it('reads the grant fresh, since the decision closes setup for good', async () => {
  h.status.mockResolvedValue('ready')
  await finish({ skipSites: true })
  expect(h.forget).toHaveBeenCalledWith('u_7')
  expect(h.forget.mock.invocationCallOrder[0]!).toBeLessThan(h.status.mock.invocationCallOrder[0]!)
})

it('refuses, with a retry, when gscdump cannot say whether the grant works', async () => {
  h.status.mockResolvedValue(null)
  await expect(finish({ skipSites: true })).rejects.toMatchObject({ message: 'Request Indexing could not check your Google connection. Try again in a moment.' })
  expect(completedAt()).toBeNull()
})

it('asks gscdump nothing when setup is already finished', async () => {
  sqlite.prepare('UPDATE users SET onboarding_completed_at = ? WHERE user_id = 7').run(Date.now())
  await finish({ skipSites: true })
  expect(h.status).not.toHaveBeenCalled()
})
