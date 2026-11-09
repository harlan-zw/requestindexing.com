import { expect, it } from 'vitest'
import { buildCustomerInsights, parseCustomerInsightsQuery } from './customer-insights'
import { buildObservedFunnelUsers } from './funnel-observations'

it('keeps legacy account cohorts, optional feedback and unknown hosted usage distinct', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const users = buildObservedFunnelUsers([{ id: 1, name: 'Ada', email: 'ada@example.test', createdAt: '2026-11-01 00:00:00', completedAt: null, source: null, teamId: 1, engineUserId: 'engine-one' }], [{ userId: 1, type: 'setup_feedback', createdAt: now - 1, payload: { reason: 'time', step: 'page' } }], [], now)
  const parsed = parseCustomerInsightsQuery({ timeRange: '30d' })
  if (!parsed.success)
    throw new Error('Invalid fixture')
  const report = buildCustomerInsights(users, parsed.data, now)
  expect(report.coverage).toMatchObject({ cohortUsers: 1, signupEvents: 0, accountDateFallbacks: 1, goalAnswers: 0 })
  expect(report.capabilities).toEqual({ goals: false, acquisition: true, integrationActivity: false })
  expect(report.users[0]?.goals).toEqual([])
  expect(report.users[0]?.feedback).toMatchObject([{ reason: 'time' }])
  expect(report.integrations.map(row => [row.surface, row.successfulCalls, row.configuredUsers])).toEqual([['mcp', null, null], ['cli', null, null], ['api', null, null]])
  expect(report.segments[0]?.returned).toBeNull()
  expect(report.segments[0]?.paid).toBeNull()
})
it.each([{ timeRange: '0d' }, { timeRange: '999d' }, { page: -1 }, { perPage: 1000 }, { userId: 'user-secret' }, { source: ['one', 'two'] }])('refuses unbounded filters %j', (query) => {
  expect(parseCustomerInsightsQuery(query).success).toBe(false)
})
