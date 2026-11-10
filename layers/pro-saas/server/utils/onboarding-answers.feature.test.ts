import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import read from '../api/pro/onboarding/answers.get'
import write from '../api/pro/onboarding/answers.post'

interface Context { event: H3Event, db: ReturnType<typeof useDrizzle>, caller: { user: { id: number } }, body: unknown }
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (options: { body?: ZodType }, handle: (context: Context) => unknown) => (context: Context) => handle({ ...context, body: options.body ? options.body.parse(context.body) : undefined }) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-browser-origin', () => ({ assertGscdumpBrowserUnsafeMethodOrigin: vi.fn() }))

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>
const context = (body: unknown, userId: number) => ({ event: {} as H3Event, db: db as unknown as ReturnType<typeof useDrizzle>, caller: { user: { id: userId } }, body })
const send = async (body: unknown, userId = 7) => (write as unknown as (context: Context) => Promise<unknown>)(context(body, userId))
const state = async (userId = 7) => (read as unknown as (context: Context) => Promise<unknown>)(context(undefined, userId))

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite)
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  for (const id of [7, 8])
    sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, `user-${id}`, 'Test', `${id}@example.test`, '', Date.now(), `sub-${id}`, 1)
})
afterEach(() => sqlite.close())

it('opens with no answers for a new user', async () => {
  expect(await state()).toEqual({ _tag: 'Open', answers: { intents: [] } })
})

it('keeps partial answers from each tap without closing the card', async () => {
  expect(await send({ answers: { role: 'agency', intents: [] } })).toEqual({ _tag: 'Saved' })
  await send({ answers: { role: 'agency', siteCount: '21+', intents: ['why-not', 'launch'], other: '  bulk sitemaps  ' } })
  expect(await state()).toEqual({ _tag: 'Open', answers: { role: 'agency', siteCount: '21+', intents: ['why-not', 'launch'], other: 'bulk sitemaps' } })
  expect(await state(8)).toEqual({ _tag: 'Open', answers: { intents: [] } })
})

it('closes the card for good once submitted or skipped, and refuses later writes', async () => {
  await send({ answers: { seoExperience: 'new', intents: [] } })
  expect(await send({ answers: { seoExperience: 'new', intents: [] }, close: true })).toEqual({ _tag: 'Saved' })
  expect(await state()).toEqual({ _tag: 'Closed' })
  expect(await send({ answers: { role: 'solo', intents: [] } })).toEqual({ _tag: 'Closed' })
  expect(sqlite.prepare('SELECT onboarding_answers FROM users WHERE user_id = 7').get()).toEqual({ onboarding_answers: JSON.stringify({ seoExperience: 'new', intents: [] }) })
})

it.each([
  [{ answers: { role: 'ceo', intents: [] } }],
  [{ answers: { siteCount: '100', intents: [] } }],
  [{ answers: { seoExperience: 'expert', intents: [] } }],
  [{ answers: { intents: ['competitors'] } }],
  [{ answers: { intents: ['launch', 'launch'] } }],
  [{ answers: { intents: [], other: 'x'.repeat(501) } }],
  [{ answers: { intents: [], source: 'twitter' } }],
  [{ answers: { intents: [] }, close: 'yes' }],
])('refuses an answer outside the shared ids: %j', async (body) => {
  await expect(send(body)).rejects.toThrow()
  expect(await state()).toEqual({ _tag: 'Open', answers: { intents: [] } })
})

it('reads a malformed stored value as no answers instead of failing', async () => {
  sqlite.prepare('UPDATE users SET onboarding_answers = ? WHERE user_id = 7').run('{"role":"ceo"}')
  expect(await state()).toEqual({ _tag: 'Open', answers: { intents: [] } })
})
