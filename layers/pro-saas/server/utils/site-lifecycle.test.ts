import type { PartnerLifecycleResponse, PartnerLifecycleSite } from '#layers/pro-gsc/shared/gscdump-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNearRetentionLimit, readOptionalUserLifecycle, syncStatusFor } from './site-lifecycle'

describe('isNearRetentionLimit', () => {
  afterEach(() => vi.useRealTimers())

  it('uses the Search Console 16 month retention boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T02:00:00Z'))

    expect(isNearRetentionLimit('2025-04-12')).toBe(false)
  })
})

describe('readOptionalUserLifecycle', () => {
  const lifecycle = { sites: [] } as unknown as PartnerLifecycleResponse

  it('loads the lifecycle for a user gscdump knows', async () => {
    const reader = { getUserLifecycle: async () => lifecycle }

    const result = await readOptionalUserLifecycle('gscdump-user-1', () => reader)

    expect(result).toEqual({ _tag: 'Loaded', lifecycle, reader })
  })

  it('skips the read for a user gscdump does not know', async () => {
    const createClient = vi.fn()

    const result = await readOptionalUserLifecycle(null, createClient)

    expect(result).toEqual({ _tag: 'Skipped' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('reports a client that fails to build instead of throwing', async () => {
    const result = await readOptionalUserLifecycle('gscdump-user-1', () => {
      throw new Error('GSCDUMP_API_KEY not configured')
    })

    expect(result).toEqual({ _tag: 'Unavailable', reason: 'GSCDUMP_API_KEY not configured' })
  })

  it('reports a lifecycle request that fails instead of throwing', async () => {
    const result = await readOptionalUserLifecycle('gscdump-user-1', () => ({
      getUserLifecycle: async () => {
        throw new Error('502 Bad Gateway')
      },
    }))

    expect(result).toEqual({ _tag: 'Unavailable', reason: '502 Bad Gateway' })
  })
})

interface SiteInput {
  status: PartnerLifecycleSite['analytics']['status']
  completed: number
  failed: number
  total: number
  hold?: PartnerLifecycleSite['hold']
}

function lifecycleSite({ status, completed, failed, total, hold = null }: SiteInput): PartnerLifecycleSite {
  return {
    siteId: 's_test',
    externalSiteId: null,
    requestedUrl: 'https://example.com/',
    gscPropertyUrl: 'sc-domain:example.com',
    permissionLevel: 'siteOwner',
    hold,
    analytics: {
      status,
      queryable: status === 'ready' || status.startsWith('queryable'),
      progress: { percent: total ? Math.round((completed / total) * 100) : 0, completed, failed, total },
      syncedRange: { oldest: null, newest: null },
    },
    indexing: { status: 'not_requested', eligible: false, reason: null, progress: null },
    latestError: null,
    updatedAt: null,
  } as unknown as PartnerLifecycleSite
}

describe('site sync status', () => {
  it('reads a Site registered a second ago as pending, not synced', () => {
    expect(syncStatusFor(lifecycleSite({ status: 'queryable_live', completed: 0, failed: 0, total: 0 }), null)).toBe('pending')
  })

  it('reads a Backfill with a failed day as an error', () => {
    expect(syncStatusFor(lifecycleSite({ status: 'queryable_partial', completed: 667, failed: 1, total: 668 }), null)).toBe('error')
  })

  it('reads a held Site as pending', () => {
    expect(syncStatusFor(lifecycleSite({ status: 'queued', completed: 0, failed: 0, total: 0, hold: 'size_limit' }), null)).toBe('pending')
  })

  it('reads open Sync jobs as syncing', () => {
    expect(syncStatusFor(lifecycleSite({ status: 'queryable_live', completed: 3, failed: 0, total: 668 }), null)).toBe('syncing')
  })

  it.each([
    ['a record that serves reads', { status: 'ready', completed: 668, failed: 0, total: 668 }],
    ['a host with no Search Console rows', { status: 'queryable_live', completed: 668, failed: 0, total: 668 }],
  ] as const)('reads %s as synced', (_label, input) => {
    expect(syncStatusFor(lifecycleSite(input), null)).toBe('synced')
  })

  it('falls back to the stored status without a lifecycle row', () => {
    expect(syncStatusFor(null, 'syncing')).toBe('syncing')
    expect(syncStatusFor(null, null)).toBe('pending')
  })
})
