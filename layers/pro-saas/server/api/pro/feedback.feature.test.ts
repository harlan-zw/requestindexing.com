import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { migratedDatabase, proDatabase } from '~~/tests/support/migrated-d1'
import feedbackResource from '../../admin/resources/feedback'
import proFeedbackResource from '../../admin/resources/pro-feedback'
import { feedback as feedbackTable } from '../../database/_surface'
import { feedbackTriageSet, listDashboardFeedbackHistory } from '../../utils/dashboard-feedback'
import feedback from './feedback.post'

interface Context { event: H3Event, db: ReturnType<typeof useDrizzle>, caller: { user: { id: number } }, team: { team: { teamId: number } }, body: unknown }
const sendEmailMock = vi.hoisted(() => vi.fn())
vi.mock('#layers/pro-saas/server/utils/handler', () => ({ defineProApiHandler: (options: { body: ZodType }, handle: (context: Context) => unknown) => (context: Context) => handle({ ...context, body: options.body.parse(context.body) }) }))
vi.mock('#layers/pro-gsc/server/utils/gscdump-browser-origin', () => ({ assertGscdumpBrowserUnsafeMethodOrigin: vi.fn() }))
vi.mock('~~/layers/core/server/utils/email', () => ({ sendEmail: sendEmailMock }))

let sqlite: ReturnType<typeof migratedDatabase>
let db: ReturnType<typeof proDatabase>
let pendingWaitUntil: Promise<unknown>[]
async function send(body: unknown) {
  return (feedback as unknown as (context: Context) => Promise<unknown>)({
    event: { waitUntil: (work: Promise<unknown>) => { pendingWaitUntil.push(work) } } as unknown as H3Event,
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
  pendingWaitUntil = []
  sendEmailMock.mockReset().mockResolvedValue({ _tag: 'Sent' })
  sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-one', 'Team')
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(7, 'user-7', 'Test', '7@example.test', '', Date.now(), 'sub-7', 1)
})
afterEach(async () => {
  await Promise.allSettled(pendingWaitUntil)
  sqlite.close()
})

it('stores a bug report with its diagnostics where the admin feedback resources read it and alerts the operator', async () => {
  expect(await send({ intent: 'bug', path: '/pro/dashboard/sites/s_1', comment: '  Chart is blank  ', siteId: 's_1', viewport: '390x844', clientErrors: ['TypeError: x'] })).toEqual({ _tag: 'Recorded' })
  await Promise.all(pendingWaitUntil)
  expect(rows()).toEqual([{
    path: '/pro/dashboard/sites/s_1',
    thumb: null,
    comment: 'Chart is blank',
    userId: 7,
    metadata: { source: 'dashboard-drawer', teamId: 1, intent: 'bug', siteId: 's_1', viewport: '390x844', clientErrors: ['TypeError: x'] },
  }])
  expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
    to: 'harlan@harlanzw.com',
    replyTo: '7@example.test',
    subject: 'Request Indexing feedback: /pro/dashboard/sites/s_1',
  }))
})

it('still records feedback when operator email delivery fails', async () => {
  sendEmailMock.mockRejectedValueOnce(new Error('Postmark unreachable'))
  expect(await send({ intent: 'improvement', path: '/pro/dashboard', comment: 'Add export' })).toEqual({ _tag: 'Recorded' })
  await expect(Promise.all(pendingWaitUntil)).resolves.toBeDefined()
  expect(rows()).toHaveLength(1)
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

it('returns only the account submissions with public resolutions and hides internal triage notes', async () => {
  sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(8, 'user-8', 'Other', '8@example.test', '', Date.now(), 'sub-8', 1)
  await send({ intent: 'bug', path: '/pro/dashboard/sites/s_1', comment: 'Blank chart' })
  await send({ intent: 'other', path: '/pro/dashboard', sentiment: 'happy', comment: 'Duplicate' })
  await (feedback as unknown as (context: Context) => Promise<unknown>)({
    event: {} as H3Event,
    db: db as unknown as ReturnType<typeof useDrizzle>,
    caller: { user: { id: 8 } },
    team: { team: { teamId: 1 } },
    body: { path: '/pro/dashboard', sentiment: 'love', comment: 'Other user' },
  })

  const fixedAt = new Date('2026-11-22T12:00:00.000Z')
  const stored = sqlite.prepare('SELECT feedback_id, comment FROM feedback ORDER BY feedback_id').all() as Array<{ feedback_id: number, comment: string }>
  const firstId = stored.find(r => r.comment === 'Blank chart')!.feedback_id
  const secondId = stored.find(r => r.comment === 'Duplicate')!.feedback_id

  await db.update(feedbackTable)
    .set(feedbackTriageSet({
      status: 'fixed',
      triageNote: 'Private root cause',
      resolutionNote: 'Fixed the site-switch cache reset.',
      fixRef: '#42',
    }, fixedAt))
    .where(eq(feedbackTable.feedbackId, firstId))
  await db.update(feedbackTable)
    .set(feedbackTriageSet({
      status: 'ignored',
      triageNote: 'Private duplicate reason',
    }, fixedAt))
    .where(eq(feedbackTable.feedbackId, secondId))

  const history = await listDashboardFeedbackHistory(db as unknown as ReturnType<typeof useDrizzle>, 7)
  expect(history.hasMore).toBe(false)
  expect(history.items).toHaveLength(2)
  const fixedItem = history.items.find(item => item.comment === 'Blank chart')!
  const ignoredItem = history.items.find(item => item.comment === 'Duplicate')!
  expect(fixedItem).toMatchObject({
    id: String(firstId),
    intent: 'bug',
    resolution: 'fixed',
    resolutionNote: 'Fixed the site-switch cache reset.',
    resolvedAt: fixedAt.toISOString(),
  })
  expect(ignoredItem).toMatchObject({
    id: String(secondId),
    intent: 'other',
    sentiment: 'happy',
    resolution: 'closed',
    resolutionNote: null,
    resolvedAt: null,
  })
  for (const item of history.items) {
    expect(item).not.toHaveProperty('triageNote')
    expect(item).not.toHaveProperty('fixRef')
  }
})
