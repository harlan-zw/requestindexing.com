import type { CheckResult } from '@harlan-zw/nuxt-checkin/server'
import { runChecks } from '@harlan-zw/nuxt-checkin/server'
import { expect, it } from 'vitest'
import database from '../server/checks/database'
import integration from '../server/checks/integration'

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
