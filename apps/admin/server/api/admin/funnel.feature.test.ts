import type { DatabaseSync } from 'node:sqlite'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { drizzle } from 'drizzle-orm/d1'
import { createError, createEvent } from 'h3'
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
  const request = new IncomingMessage(new Socket())
  const result = await handler(createEvent(request, new ServerResponse(request)))
  if (typeof result === 'string')
    throw new Error('Expected JSON report')
  return result
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
  it('uses immutable signup attribution and first qualifying evidence while excluding secrets from exports', async () => {
    sqlite.exec('UPDATE users SET source = \'changed-current-source\' WHERE user_id = 1')
    const insert = sqlite.prepare('INSERT INTO pro_events (user_id, type, created_at, payload) VALUES (1, ?, ?, ?)')
    insert.run('signed_up', Date.parse('2026-10-01T00:00:00Z'), JSON.stringify({ source: 'pro-free', attributionBasis: 'journey_linked', attributionSource: 'utm:newsletter', provider: 'google' }))
    insert.run('site_added', Date.parse('2026-10-02T00:00:00Z'), null)
    insert.run('page_inspection_started', Date.parse('2026-10-03T00:00:00Z'), null)
    insert.run('first_report_evidence_viewed', Date.parse('2026-10-04T00:00:00Z'), null)
    const result = await read()
    expect(result.users[0]?.source).toBe('utm:newsletter')
    expect(result.users[0]?.journey?.stageTimes.evidenceViewed).toBe('2026-10-04T00:00:00.000Z')
    expect(result.evidenceViewed).toBe(1)
    query.format = 'csv'
    const handler = (await import('./funnel.get')).default
    const request = new IncomingMessage(new Socket())
    const csv = await handler(createEvent(request, new ServerResponse(request)))
    expect(csv).toContain('utm:newsletter')
    expect(csv).not.toContain('must-not-leak')
    expect(csv).not.toContain('changed-current-source')
  })
  it('protects CSV and shared insights behind the same administrator boundary', async () => {
    query.format = 'csv'
    vi.stubGlobal('getUserSession', async () => ({ user: { email: 'someone@example.test' } }))
    await expect(read()).rejects.toMatchObject({ statusCode: 403 })
    const handler = (await import('./analytics/customer-insights.get')).default
    const request = new IncomingMessage(new Socket())
    await expect(handler(createEvent(request, new ServerResponse(request)))).rejects.toMatchObject({ statusCode: 403 })
    expect(useDrizzle).not.toHaveBeenCalled()
  })
  it('serves shared customer insights with local milestones and explicit hosted-use gaps', async () => {
    const insert = sqlite.prepare('INSERT INTO pro_events (user_id, type, created_at, payload) VALUES (1, ?, ?, ?)')
    insert.run('signed_up', Date.parse('2026-10-01T00:00:00Z'), JSON.stringify({ attributionBasis: 'journey_linked', attributionSource: 'utm:newsletter' }))
    insert.run('site_added', Date.parse('2026-10-02T00:00:00Z'), null)
    insert.run('page_evidence_viewed', Date.parse('2026-10-03T00:00:00Z'), null)
    insert.run('setup_feedback', Date.parse('2026-10-04T00:00:00Z'), JSON.stringify({ step: 'page', reason: 'time' }))
    query = { userId: '1', source: 'utm:newsletter', timeRange: '1d' }
    const handler = (await import('./analytics/customer-insights.get')).default
    const request = new IncomingMessage(new Socket())
    const event = createEvent(request, new ServerResponse(request))
    const result = await handler(event)
    expect(result.pagination.total).toBe(1)
    expect(result.coverage).toMatchObject({ signupEvents: 1, accountDateFallbacks: 0 })
    expect(result.segments[0]).toMatchObject({ key: 'utm:newsletter', activated: 1, returned: null })
    expect(result.users[0]).toMatchObject({ source: { label: 'utm:newsletter', basis: 'captured' }, goals: [], feedback: [{ step: 'page', reason: 'time', recordedAt: '2026-10-04T00:00:00.000Z' }] })
    expect(result.users[0]?.journey.stageTimes).toMatchObject({ siteConnected: '2026-10-02T00:00:00.000Z', evidenceViewed: '2026-10-03T00:00:00.000Z' })
    expect(result.integrations.every(row => row.successfulCalls === null && row.configuredUsers === null && row.coverage === 'unavailable')).toBe(true)
    expect(event.node.res.getHeader('Cache-Control')).toBe('private, no-store')
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })
  it('reports Onboarding Answers in the funnel and in shared customer insights, ignoring a malformed row', async () => {
    sqlite.exec(`INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id, created_at, onboarding_answers)
      VALUES (2, 'u_two', 'Bo', 'bo@example.test', '', 1, 'google-2', 1, '2026-04-22 15:13:53', '{"role":"ceo","intents":[]}');`)
    sqlite.prepare('UPDATE users SET onboarding_answers = ? WHERE user_id = 1').run(JSON.stringify({ role: 'agency', siteCount: '6-20', intents: ['why-not', 'launch'], other: 'bulk sitemaps' }))
    const insert = sqlite.prepare('INSERT INTO pro_events (user_id, type, created_at) VALUES (?, ?, ?)')
    insert.run(1, 'signed_up', Date.parse('2026-10-01T12:00:00Z'))
    insert.run(2, 'signed_up', Date.parse('2026-10-02T12:00:00Z'))
    const result = await read()
    expect(result.onboardingAnswers.answered).toBe(1)
    const role = result.onboardingAnswers.questions.find(question => question.key === 'role')
    expect(role?.options.find(option => option.id === 'agency')).toMatchObject({ label: 'Agency or freelancer', users: 1 })
    expect(role?.options.reduce((sum, option) => sum + option.users, 0)).toBe(1)
    expect(result.onboardingAnswers.questions.find(question => question.key === 'intents')?.options.filter(option => option.users).map(option => option.id)).toEqual(['why-not', 'launch'])
    expect(result.onboardingAnswers.other).toEqual([{ userId: 1, text: 'bulk sitemaps' }])

    query = { userId: '1', timeRange: '366d' }
    const handler = (await import('./analytics/customer-insights.get')).default
    const request = new IncomingMessage(new Socket())
    const insights = await handler(createEvent(request, new ServerResponse(request)))
    expect(insights.capabilities.goals).toBe(true)
    expect(insights.coverage.goalAnswers).toBe(1)
    expect(insights.users[0]).toMatchObject({ goals: ['why-not', 'launch'], other: 'bulk sitemaps' })
    expect(insights.segments).toContainEqual(expect.objectContaining({ dimension: 'goal', key: 'why-not', label: 'Find why pages are not indexed', users: 1 }))
  })
})
