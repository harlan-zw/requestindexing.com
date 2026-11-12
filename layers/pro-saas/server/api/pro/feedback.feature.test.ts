import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import feedbackResource from '../../admin/resources/feedback'
import proFeedbackResource from '../../admin/resources/pro-feedback'
import feedback from './feedback.post'

interface Context { event: H3Event, db: ReturnType<typeof useDrizzle>, caller: { user: { id: number } }, team: { team: { teamId: number } }, body: unknown }
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (options: { body: ZodType }, handle: (context: Context) => unknown) => (context: Context) => handle({ ...context, body: options.body.parse(context.body) }) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-browser-origin', () => ({ assertGscdumpBrowserUnsafeMethodOrigin: vi.fn() }))

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>
async function send(body: unknown) {
  return (feedback as unknown as (context: Context) => Promise<unknown>)({
    event: {} as H3Event,
    db: db as unknown as ReturnType<typeof useDrizzle>,
    caller: { user: { id: 7 } },
    team: { team: { teamId: 1 } },
    body,
  })
}
function rows() {
  return sqlite.prepare('SELECT path, thumb, comment, metadata, user_id FROM feedback ORDER BY feedback_id').all().map(row => ({ path: row.path, thumb: row.thumb, comment: row.comment, userId: row.user_id, metadata: JSON.parse(row.metadata as string) }))
}

beforeEach(() => {
  sqlite = migratedDatabase()
  db = proDatabase(sqlite)
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(7, 'user-7', 'Test', '7@example.test', '', Date.now(), 'sub-7', 1)
})
afterEach(() => sqlite.close())

it('stores a bug report with its diagnostics where the admin feedback resources read it', async () => {
  expect(await send({ intent: 'bug', path: '/pro/dashboard/sites/s_1', comment: '  Chart is blank  ', siteId: 's_1', viewport: '390x844', clientErrors: ['TypeError: x'] })).toEqual({ _tag: 'Recorded' })
  expect(rows()).toEqual([{
    path: '/pro/dashboard/sites/s_1',
    thumb: null,
    comment: 'Chart is blank',
    userId: 7,
    metadata: { source: 'dashboard-drawer', teamId: 1, intent: 'bug', siteId: 's_1', viewport: '390x844', clientErrors: ['TypeError: x'] },
  }])
})

it('maps the four faces onto the stored thumb and keeps the face in metadata', async () => {
  await send({ path: '/pro/dashboard', sentiment: 'love' })
  await send({ path: '/pro/dashboard', sentiment: 'sad', comment: 'Slow' })
  expect(rows().map(row => [row.thumb, row.comment, row.metadata.sentiment, row.metadata.intent])).toEqual([
    ['up', null, 'love', 'other'],
    ['down', 'Slow', 'sad', 'other'],
  ])
})

it('refuses a report the shell contract rejects and stores nothing', async () => {
  await expect(send({ intent: 'bug', path: '/pro/dashboard', comment: '   ' })).rejects.toThrow()
  await expect(send({ path: '/pro/dashboard' })).rejects.toThrow()
  await expect(send({ path: '', sentiment: 'happy' })).rejects.toThrow()
  await expect(send({ path: '/pro/dashboard', sentiment: 'meh' })).rejects.toThrow()
  expect(rows()).toEqual([])
})

it('answers Unavailable as a value when the write fails', async () => {
  sqlite.exec('DROP TABLE feedback')
  expect(await send({ path: '/pro/dashboard', sentiment: 'happy' })).toEqual({ _tag: 'Unavailable' })
})

it('lists the stored report in the admin Pro feedback and Feedback resources', async () => {
  await send({ intent: 'improvement', path: '/pro/dashboard', sentiment: 'happy', comment: 'Show the sitemap age' })
  const ctx = { db: db as never } as never
  const pro = await proFeedbackResource.index!(ctx, {} as never)
  const all = await feedbackResource.index!(ctx, {} as never)
  for (const listing of [pro, all]) {
    expect(listing.total).toBe(1)
    expect(listing.rows[0]).toMatchObject({ path: '/pro/dashboard', thumb: 'up', comment: 'Show the sitemap age', userId: 7 })
  }
})
