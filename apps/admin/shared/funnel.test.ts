import type { FunnelUser } from './funnel'
import { describe, expect, it } from 'vitest'
import { buildFunnelReport, defaultFunnelDates, funnelTimestamp, parseFunnelQuery } from './funnel'

const now = Date.parse('2026-10-18T12:00:00Z')
const query = parseFunnelQuery({ from: '2026-10-01', to: '2026-10-07' }, now)
function user(id: number, overrides: Partial<FunnelUser> = {}): FunnelUser {
  return { id, name: `User ${id}`, email: `user${id}@example.test`, signedUpAt: '2026-10-01T00:00:00.000Z', signupEvidence: 'event', source: 'Direct', googleConnected: false, siteConnected: false, setupCompleted: false, ...overrides }
}

describe('signup cohort funnel', () => {
  it('includes both date endpoints, excludes other cohorts, and fills zero days', () => {
    const report = buildFunnelReport([
      user(1),
      user(2, { signedUpAt: '2026-10-07T23:59:59.999Z' }),
      user(3, { signedUpAt: '2026-09-30T23:59:59.999Z' }),
      user(4, { signedUpAt: '2026-10-08T00:00:00.000Z' }),
    ], query, now)
    expect(report.total).toBe(2)
    expect(report.days).toHaveLength(7)
    expect(report.days.map(day => day.count)).toEqual([1, 0, 0, 0, 0, 0, 1])
  })

  it('follows the signup cohort through later completion and keeps skipped steps separate', () => {
    const report = buildFunnelReport([
      user(1),
      user(2, { googleConnected: true }),
      user(3, { googleConnected: true, siteConnected: true }),
      user(4, { googleConnected: true, siteConnected: true, setupCompleted: true }),
      user(5, { setupCompleted: true }),
    ], query, now)
    expect(report.stages.map(step => step.count)).toEqual([5, 3, 2, 1])
    expect(report.stages.map(step => step.dropped)).toEqual([0, 2, 1, 1])
    expect(report.stages[2]?.conversion).toBe(66.7)
    expect(report.setupCompleted).toBe(2)
    expect(report.completedOutsidePath).toBe(1)
    expect(report.stages[3]?.observed).toBe(2)
  })

  it('uses progress/search filters only for drilldown, not the funnel denominator', () => {
    const report = buildFunnelReport([user(1), user(2, { googleConnected: true })], { ...query, stage: 'googleConnected', search: 'USER1' }, now)
    expect(report.total).toBe(2)
    expect(report.users.map(row => row.id)).toEqual([1])
  })

  it('filters the entire cohort by source and retains available source choices', () => {
    const report = buildFunnelReport([user(1), user(2, { source: 'Partner', signupEvidence: 'account' })], { ...query, source: 'Partner' }, now)
    expect(report.total).toBe(1)
    expect(report.sources).toEqual(['Direct', 'Partner'])
    expect(report.accountDateFallbacks).toBe(1)
    expect(report.days[0]?.count).toBe(1)
  })

  it('does not turn an empty cohort into NaN or 100% conversion', () => {
    const report = buildFunnelReport([], query, now)
    expect(report.stages.every(step => step.percent === null && step.conversion === null)).toBe(true)
    expect(report.pagination).toMatchObject({ page: 1, pageCount: 1, total: 0 })
  })

  it('paginates the user drilldown without truncating totals', () => {
    const report = buildFunnelReport(Array.from({ length: 121 }, (_, i) => user(i + 1)), { ...query, page: 99 }, now)
    expect(report.total).toBe(121)
    expect(report.pagination.page).toBe(3)
    expect(report.users).toHaveLength(21)
    expect(report.users[0]?.id).toBe(21)
  })
})

describe('funnel dates', () => {
  it('normalizes seconds, milliseconds, numeric strings and SQLite timestamps to UTC', () => {
    const stamp = '2026-10-01T00:00:00.000Z'
    for (const value of [Date.parse(stamp), Date.parse(stamp) / 1000, `${Date.parse(stamp)}`, '2026-10-01 00:00:00', stamp])
      expect(funnelTimestamp(value)).toBe(stamp)
    for (const value of [null, undefined, '', 'invalid', Infinity, -1, {}, true])
      expect(funnelTimestamp(value)).toBeNull()
  })

  it('defaults to 30 inclusive UTC days across a month boundary', () => {
    expect(defaultFunnelDates(now)).toEqual({ from: '2026-09-19', to: '2026-10-18' })
  })

  it.each([
    { from: '2026-02-30' },
    { from: ['2026-10-01'] },
    { from: '2026-10-08', to: '2026-10-01' },
    { from: '2020-01-01', to: '2026-10-01' },
    { stage: 'unknown' },
    { page: -1 },
    { page: 'NaN' },
    { search: ['one', 'two'] },
    { source: ['Direct'] },
  ])('rejects invalid query %j', input => expect(() => parseFunnelQuery(input, now)).toThrow())
})
