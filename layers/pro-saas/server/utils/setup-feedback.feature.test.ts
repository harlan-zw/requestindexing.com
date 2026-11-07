import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import feedback from '../api/pro/onboarding/feedback.post'
import { emitFirstProEvent } from './pro-events'

interface Context { event: H3Event, db: ReturnType<typeof useDrizzle>, caller: { user: { id: number } }, body: unknown }
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (options: { body: ZodType }, handle: (context: Context) => unknown) => (context: Context) => handle({ ...context, body: options.body.parse(context.body) }) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-browser-origin', () => ({ assertGscdumpBrowserUnsafeMethodOrigin: vi.fn() }))

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>
const now = Date.now()
const send = async (body: unknown, userId = 7) => (feedback as unknown as (context: Context) => Promise<unknown>)({ event: {} as H3Event, db: db as unknown as ReturnType<typeof useDrizzle>, caller: { user: { id: userId } }, body })
const answers = () => sqlite.prepare('SELECT user_id, payload FROM pro_events WHERE type = \'setup_feedback\' ORDER BY user_id, pro_event_id').all().map(row => ({ userId: row.user_id, ...JSON.parse(row.payload as string) }))

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite)
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  for (const id of [7, 8])
    sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, `user-${id}`, 'Test', `${id}@example.test`, '', now, `sub-${id}`, 1)
})
afterEach(() => sqlite.close())

it('keeps the corrected reason for each step instead of silently retaining the first selection', async () => {
  await send({ reason: 'permission', step: 'connect' })
  await send({ reason: 'property', step: 'connect' })
  await send({ reason: 'time', step: 'page' })
  expect(answers()).toEqual([{ userId: 7, reason: 'property', step: 'connect' }, { userId: 7, reason: 'time', step: 'page' }])
})

it('bounds concurrent corrections to one answer per step and isolates other users', async () => {
  await Promise.all([send({ reason: 'permission', step: 'sites' }), send({ reason: 'value', step: 'sites' })])
  expect(answers()).toEqual([{ userId: 7, reason: 'value', step: 'sites' }])
  await send({ reason: 'time', step: 'sites' })
  await send({ reason: 'property', step: 'sites' }, 8)
  expect(answers()).toEqual([{ userId: 7, reason: 'time', step: 'sites' }, { userId: 8, reason: 'property', step: 'sites' }])
})

it('rolls back an inserted answer if its atomic correction fails', async () => {
  await send({ reason: 'permission', step: 'connect' })
  sqlite.exec('CREATE TRIGGER reject_feedback_update BEFORE UPDATE ON pro_events WHEN NEW.type = \'setup_feedback\' BEGIN SELECT RAISE(ABORT, \'write unavailable\'); END')
  expect(await send({ reason: 'time', step: 'page' })).toEqual({ _tag: 'Unavailable' })
  expect(await send({ reason: 'property', step: 'connect' })).toEqual({ _tag: 'Unavailable' })
  expect(answers()).toEqual([{ userId: 7, reason: 'permission', step: 'connect' }])
})

it('collapses old duplicate answers without changing a different step', async () => {
  const insert = sqlite.prepare('INSERT INTO pro_events (user_id, type, payload, created_at) VALUES (?, \'setup_feedback\', ?, ?)')
  insert.run(7, JSON.stringify({ reason: 'permission', step: 'connect' }), now)
  insert.run(7, JSON.stringify({ reason: 'value', step: 'connect' }), now)
  insert.run(7, JSON.stringify({ reason: 'time', step: 'page' }), now)
  await send({ reason: 'property', step: 'connect' })
  expect(answers()).toEqual([{ userId: 7, reason: 'property', step: 'connect' }, { userId: 7, reason: 'time', step: 'page' }])
})

it('keeps first-time milestone deduplication independent from corrections', async () => {
  const database = db as unknown as ReturnType<typeof useDrizzle>
  await emitFirstProEvent(database, 7, 'site_added', { count: 1 })
  await emitFirstProEvent(database, 7, 'site_added', { count: 2 })
  expect(sqlite.prepare('SELECT payload FROM pro_events WHERE type = \'site_added\'').all().map(row => JSON.parse(row.payload as string))).toEqual([{ count: 1 }])
})

it('rejects arbitrary feedback fields and reports unavailable persistence as a value', async () => {
  await expect(send({ reason: 'https://private.example/', step: 'connect' })).rejects.toThrow()
  await expect(send({ reason: 'time', step: 'other', url: 'https://private.example/' })).rejects.toThrow()
  expect(answers()).toEqual([])
  sqlite.exec('DROP TABLE pro_events')
  expect(await send({ reason: 'time', step: 'sync' })).toEqual({ _tag: 'Unavailable' })
})
