import type { PartnerLifecycleSite } from './gscdump-api'
import { describe, expect, it } from 'vitest'
import { analyticsSyncStatus } from './analytics-sync'

function analytics(status: PartnerLifecycleSite['analytics']['status'], queryable: boolean, percent = 1): PartnerLifecycleSite['analytics'] {
  return { status, queryable, progress: { percent, completed: 1, failed: 0, total: 668 } } as PartnerLifecycleSite['analytics']
}

describe('analytics sync status', () => {
  it.each(['queryable_live', 'queryable_partial'] as const)('keeps %s at one percent syncing', (status) => {
    expect(analyticsSyncStatus(analytics(status, true))).toBe('syncing')
  })

  it('marks only a completed import synced', () => {
    expect(analyticsSyncStatus(analytics('ready', true, 100))).toBe('synced')
  })

  it('keeps settled readable sources synced when there is no outstanding work', () => {
    const source = analytics('queryable_live', true, 100)
    source.progress = { percent: 100, completed: 668, failed: 0, total: 668 }
    expect(analyticsSyncStatus(source)).toBe('synced')
    source.status = 'queryable_partial'
    source.progress = { percent: 100, completed: 667, failed: 1, total: 668 }
    expect(analyticsSyncStatus(source)).toBe('synced')
  })

  it('keeps queued and failed imports distinct from readable data', () => {
    expect(analyticsSyncStatus(analytics('queued', false))).toBe('pending')
    expect(analyticsSyncStatus(analytics('failed', false))).toBe('error')
  })
})
