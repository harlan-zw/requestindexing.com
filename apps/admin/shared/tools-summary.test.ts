import { describe, expect, it } from 'vitest'
import { summarizeToolTelemetry } from './tools-summary'

describe('summarizeToolTelemetry', () => {
  it('aggregates provider calls, errors, daily spend, unique IPs, and tool feedback', () => {
    const now = new Date('2026-11-27T10:00:00Z')
    const summary = summarizeToolTelemetry({
      days: 7,
      dailyBudgetUsd: 5,
      now,
      requests: [
        {
          tool: 'check-index',
          endpoint: '/serp/google/organic/live/advanced',
          taskCount: 1,
          status: 'ok',
          httpStatus: 200,
          costUsdMicros: 1500,
          ipHash: 'ip:aaa',
          createdAt: new Date('2026-11-27T08:00:00Z'),
        },
        {
          tool: 'check-index',
          endpoint: '/serp/google/organic/live/advanced',
          taskCount: 1,
          status: 'http_error',
          httpStatus: 503,
          costUsdMicros: null,
          ipHash: 'ip:bbb',
          createdAt: new Date('2026-11-27T09:00:00Z'),
        },
        {
          tool: 'site-report',
          endpoint: '/serp/google/organic/live/advanced',
          taskCount: 2,
          status: 'ok',
          httpStatus: 200,
          costUsdMicros: 3600,
          ipHash: 'ip:aaa',
          createdAt: new Date('2026-11-26T12:00:00Z'),
        },
      ],
      feedbackRows: [
        {
          id: 1,
          path: '/tools/google-indexing-checker',
          thumb: 'up',
          comment: null,
          createdAt: new Date('2026-11-27T08:05:00Z'),
        },
        {
          id: 2,
          path: '/tools/google-indexing-checker',
          thumb: 'down',
          comment: 'Expected live inspection status',
          createdAt: new Date('2026-11-27T08:06:00Z'),
        },
      ],
    })

    expect(summary.totals).toMatchObject({
      calls: 3,
      tasks: 4,
      errors: 1,
      errorRatePct: 33.3,
      spendUsd: 0.0051,
      uniqueCallers: 2,
      todaySpendUsd: 0.0015,
      dailyBudgetUsd: 5,
      thumbsUp: 1,
      thumbsDown: 1,
    })

    const checker = summary.byTool.find(row => row.apiToolId === 'check-index')
    expect(checker).toMatchObject({
      title: 'Google Index Checker',
      calls: 2,
      errors: 1,
      uniqueCallers: 2,
      thumbsUp: 1,
      thumbsDown: 1,
    })

    expect(summary.daily.map(d => d.day)).toEqual(['2026-11-27', '2026-11-26'])
    expect(summary.recentComments).toHaveLength(1)
    expect(summary.recentComments[0]?.comment).toBe('Expected live inspection status')
  })
})
