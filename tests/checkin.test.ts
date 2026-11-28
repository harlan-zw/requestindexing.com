import type { CheckResult } from '@harlan-zw/nuxt-checkin/server'
import { runChecks } from '@harlan-zw/nuxt-checkin/server'
import { expect, it } from 'vitest'
import database from '../server/checks/database'
import feedback from '../server/checks/feedback'
import integration from '../server/checks/integration'
import { migratedDatabase } from './support/migrated-d1'

function failReason(result: CheckResult): string {
  if (result._tag !== 'Fail')
    throw new Error(`expected Fail, got ${result._tag}`)
  return result.reason
}

interface StubRow {
  name: string
}

function d1(statements: string[], tableInfo: StubRow[] | Error) {
  return {
    prepare(sql: string) {
      statements.push(sql)
      return {
        first: async () => ({ checkin_ready: 1 }),
        all: async () => {
          if (tableInfo instanceof Error)
            throw tableInfo
          return { results: tableInfo }
        },
      }
    },
  }
}

function databaseEvent(db: unknown) {
  return { context: { cloudflare: { env: { DB: db } } } }
}

it('keeps an intentional welcome email and daily sync pause healthy', async () => {
  const report = await runChecks([integration], { event: { onboardingDripEnabled: false, notificationsEnabled: false, gscdump: { apiKey: 'private', webhookSecret: 'private' } } })
  expect(report.coverage).toBe('complete')
  expect(report.results[0]?.result).toEqual({ _tag: 'Pass', evidence: { configured: true, welcomeEmailPaused: true, dailySyncPaused: true } })
  expect(JSON.stringify(report)).not.toContain('private')
})

it('reports the onboarding drip switch and the daily sync switch apart', async () => {
  const report = await runChecks([integration], { event: { onboardingDripEnabled: true, notificationsEnabled: false, gscdump: { apiKey: 'private', webhookSecret: 'private' } } })
  expect(report.results[0]?.result).toEqual({ _tag: 'Pass', evidence: { configured: true, welcomeEmailPaused: false, dailySyncPaused: true } })
})

it('marks missing integration credentials unavailable', async () => {
  const report = await runChecks([integration], { event: { onboardingDripEnabled: true, notificationsEnabled: true, gscdump: { apiKey: '', webhookSecret: '' } } })
  expect(report.coverage).toBe('incomplete')
})

it('passes when the sites table carries the migration 0014 columns', async () => {
  const statements: string[] = []
  const event = databaseEvent(d1(statements, [
    { name: 'id' },
    { name: 'public_id' },
    { name: 'team_id' },
    { name: 'property' },
  ]))
  const report = await runChecks([database], { event })
  expect(report.severity).toBe('pass')
  expect(report.coverage).toBe('complete')
  expect(report.results[0]?.result).toMatchObject({ _tag: 'Pass', evidence: { binding: 'DB', table: 'sites' } })
  expect(statements).toEqual(['PRAGMA table_info(sites)'])
})

it('fails when the sites table predates migration 0014', async () => {
  const statements: string[] = []
  const event = databaseEvent(d1(statements, [
    { name: 'site_id' },
    { name: 'public_id' },
    { name: 'property' },
    { name: 'owner_id' },
  ]))
  const report = await runChecks([database], { event })
  expect(report.severity).toBe('fail')
  const reason = failReason(report.results[0]!.result)
  expect(reason).toContain('team_id')
  expect(reason).toContain('sites')
  expect(statements).toEqual(['PRAGMA table_info(sites)'])
})

it('fails when the sites table is missing', async () => {
  const report = await runChecks([database], { event: databaseEvent(d1([], [])) })
  expect(report.severity).toBe('fail')
  expect(report.results[0]?.result._tag).toBe('Fail')
})

it('fails when the schema query errors', async () => {
  const report = await runChecks([database], { event: databaseEvent(d1([], new Error('D1_ERROR: no such table: sites'))) })
  expect(report.severity).toBe('fail')
  expect(failReason(report.results[0]!.result)).toContain('D1_ERROR')
})

it('reports a missing binding unavailable', async () => {
  const report = await runChecks([database], { event: { context: { cloudflare: { env: {} } } } })
  expect(report.coverage).toBe('incomplete')
  expect(report.results[0]?.result._tag).toBe('Unavailable')
})

it('ignores anonymous tool thumbs for warning severity while surfacing them as signal', async () => {
  const sqlite = migratedDatabase()
  try {
    const db = {
      prepare: (sql: string) => ({
        first: async () => sqlite.prepare(sql).get() ?? null,
      }),
    }

    const empty = await runChecks([feedback], { event: databaseEvent(db) })
    expect(empty.severity).toBe('pass')
    expect(empty.results[0]?.result).toEqual({
      _tag: 'Pass',
      evidence: { newCount: 0, toolThumbsDown: 0, toolThumbsUp: 0 },
    })

    // Anonymous free-tool votes should surface as signal without turning daily checkin into Warn.
    const thumbTs = Math.floor(Date.parse('2026-11-20T00:00:00Z') / 1000)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, ?, NULL, ?, NULL, ?)').run('/tools/sitemap', 'up', JSON.stringify({ source: 'tool-feedback', toolId: 'sitemap' }), thumbTs)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, ?, NULL, ?, NULL, ?)').run('/blog/post', 'up', JSON.stringify({ source: 'site-feedback' }), thumbTs)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, ?, NULL, ?, NULL, ?)').run('/tools/meta', 'down', JSON.stringify({ source: 'tool-feedback', toolId: 'meta' }), thumbTs)

    const thumbsOnly = await runChecks([feedback], { event: databaseEvent(db) })
    expect(thumbsOnly.severity).toBe('pass')
    expect(thumbsOnly.results[0]?.result).toEqual({
      _tag: 'Pass',
      evidence: { newCount: 0, toolThumbsDown: 1, toolThumbsUp: 2 },
    })

    // Actionable reports (signed-in dashboard feedback, written comments, and nullified-user account-delete churn rows) trigger Warn.
    const reportOldest = Math.floor(Date.parse('2026-11-28T00:00:00Z') / 1000)
    const reportNewer = Math.floor(Date.parse('2026-11-28T06:00:00Z') / 1000)
    sqlite.prepare('INSERT INTO teams (team_id, public_id, name) VALUES (?, ?, ?)').run(1, 'team-1', 'Team')
    sqlite.prepare('INSERT INTO users (user_id, public_id, name, email, avatar, last_login, sub, current_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(7, 'u-7', 'Test', '7@example.test', '', Date.now(), 'sub-7', 1)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, ?, NULL, ?, NULL, ?)').run('/pro/dashboard/account/delete', 'down', JSON.stringify({ type: 'account_delete', reasons: ['price'] }), reportOldest)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, ?, NULL, ?, ?, ?)').run('/pro/dashboard', 'up', JSON.stringify({ source: 'dashboard-drawer' }), 7, reportNewer)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, metadata, user_id, created_at) VALUES (?, NULL, ?, ?, NULL, ?)').run('/tools/meta', 'Broken parser', JSON.stringify({ source: 'tool-feedback' }), reportNewer)
    sqlite.prepare('INSERT INTO feedback (path, thumb, comment, user_id, status, created_at) VALUES (?, NULL, ?, ?, ?, ?)').run('/pro/dashboard', 'Already triaged', 7, 'triaged', thumbTs)

    const waiting = await runChecks([feedback], { event: databaseEvent(db) })
    expect(waiting.severity).toBe('warn')
    expect(waiting.results[0]?.result).toMatchObject({
      _tag: 'Warn',
      evidence: {
        newCount: 3,
        oldestCreatedAt: '2026-11-28T00:00:00.000Z',
        toolThumbsDown: 1,
        toolThumbsUp: 2,
        adminUrl: 'https://requestindexing.com/admin/feedback',
      },
    })
  }
  finally {
    sqlite.close()
  }

  const errored = await runChecks([feedback], {
    event: databaseEvent({
      prepare: () => ({
        first: async () => {
          throw new Error('D1_ERROR: no such table: feedback')
        },
      }),
    }),
  })
  expect(errored.severity).toBe('fail')
  expect(failReason(errored.results[0]!.result)).toContain('D1_ERROR')

  const emptyRow = await runChecks([feedback], {
    event: databaseEvent({
      prepare: () => ({
        first: async () => null,
      }),
    }),
  })
  expect(emptyRow.severity).toBe('fail')

  const missing = await runChecks([feedback], { event: { context: { cloudflare: { env: {} } } } })
  expect(missing.results[0]?.result._tag).toBe('Unavailable')
})
