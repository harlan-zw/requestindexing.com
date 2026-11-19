import { afterEach, beforeEach, expect, it } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import { buildFunnelReport, parseFunnelQuery } from '../../../../apps/admin/shared/funnel'
import { buildObservedFunnelUsers } from '../../../../apps/admin/shared/funnel-observations'
import { recordGoogleConnectEvent } from './pro-events'

// A reader can cancel, retry and fail, then retry and cancel again. The funnel
// must count where they stopped last, so every attempt keeps its own rows.

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>
const start = Date.parse('2026-11-19T00:00:00Z')

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite)
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(7, 'user-7', 'Test', '7@example.test', '', start, 'sub-7', 1)
})
afterEach(() => sqlite.close())

it('counts a signup once, at its latest attempt, after a cancel, a failed retry and a cancelled retry', async () => {
  const record = recordGoogleConnectEvent as unknown as (...args: unknown[]) => Promise<void>
  await record(db, 7, 'gsc_connect_started', 'a1', { scope: 'read' }, start + 1000)
  await record(db, 7, 'gsc_connect_cancelled', 'a1', {}, start + 2000)
  await record(db, 7, 'gsc_connect_started', 'a2', { scope: 'read' }, start + 3000)
  await record(db, 7, 'gsc_connect_failed', 'a2', { reason: 'token_exchange' }, start + 4000)
  await record(db, 7, 'gsc_connect_started', 'a3', { scope: 'read' }, start + 5000)
  await record(db, 7, 'gsc_connect_cancelled', 'a3', {}, start + 6000)
  // A reloaded callback delivers the same outcome for the same attempt again.
  await record(db, 7, 'gsc_connect_cancelled', 'a3', {}, start + 7000)

  const rows = sqlite.prepare('SELECT user_id AS userId, type, created_at AS createdAt, payload FROM pro_events ORDER BY pro_event_id').all() as { userId: number, type: string, createdAt: number, payload: string }[]
  expect(rows.map(row => row.type)).toEqual(['gsc_connect_started', 'gsc_connect_cancelled', 'gsc_connect_started', 'gsc_connect_failed', 'gsc_connect_started', 'gsc_connect_cancelled'])
  expect(rows.every(row => !row.payload.includes('@'))).toBe(true)

  const users = buildObservedFunnelUsers(
    [{ id: 7, name: 'Test', email: '7@example.test', createdAt: start, completedAt: null, source: null, teamId: 1, engineUserId: null }],
    [{ userId: 7, type: 'signed_up', createdAt: start, payload: null }, ...rows],
    [],
    start + 60_000,
  )
  const report = buildFunnelReport(users, parseFunnelQuery({ from: '2026-11-19', to: '2026-11-19' }, start + 60_000), start + 60_000)
  expect(report.googleConnectStops.filter(stop => stop.users).map(stop => [stop.key, stop.users])).toEqual([['cancelled', 1]])
})

it('ignores an unknown account instead of inserting an orphan row', async () => {
  await (recordGoogleConnectEvent as unknown as (...args: unknown[]) => Promise<void>)(db, 99, 'gsc_connect_started', 'a1', {}, start)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM pro_events').get()).toEqual({ n: 0 })
})
