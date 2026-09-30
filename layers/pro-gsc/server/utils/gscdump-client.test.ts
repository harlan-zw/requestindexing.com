import { GscdumpV1Error } from '@gscdump/sdk/v1'
import { describe, expect, it, vi } from 'vitest'
import { useGscdumpClient } from './gscdump-client'

const v1Client = vi.hoisted(() => ({
  getUserLifecycle: vi.fn(),
  createSite: vi.fn(),
}))

vi.mock('./gscdump-origin', () => ({
  createGscdumpPublicV1Client: () => v1Client,
}))

describe('useGscdumpClient', () => {
  it('keeps the legacy sync-status operation on the canonical client', () => {
    expect(useGscdumpClient().getSiteSyncStatus).toBeTypeOf('function')
  })

  it('normalizes public v1 lifecycle data to the partner contract', async () => {
    v1Client.getUserLifecycle.mockResolvedValueOnce({
      data: {
        userId: 'user-1',
        partnerId: null,
        currentTeamId: null,
        account: {
          status: 'ready',
          grantedScopes: [],
          missingScopes: [],
          nextAction: 'none',
        },
        sites: [{
          siteId: 'site-1',
          externalSiteId: null,
          requestedUrl: 'https://example.com',
          gscPropertyUrl: null,
          permissionLevel: null,
          property: { status: 'registered', nextAction: 'none' },
          analytics: {
            status: 'ready',
            progress: { completed: 1, failed: 0, total: 1, percent: 100 },
            queryable: true,
            sourceMode: 'd1',
            syncedRange: { oldest: null, newest: null },
            nextAction: 'none',
          },
          sitemaps: { status: 'ready', discoveredCount: 1, nextAction: 'none' },
          indexing: {
            status: 'ready',
            eligible: true,
            reason: null,
            progress: { completed: 1, failed: 0, total: 1, percent: 100 },
            nextAction: 'none',
          },
          latestError: null,
          updatedAt: '2026-08-11T00:00:00.000Z',
        }],
      },
    })

    const lifecycle = await useGscdumpClient().getUserLifecycle('user-1')

    expect(lifecycle.contractVersion).toBe('2026-05-11')
    expect(lifecycle.sites[0]).toMatchObject({
      intId: null,
      catalogSiteId: null,
      lifecycleRevision: 0,
    })
  })

  it('returns an entitlement refusal from Site registration as a value', async () => {
    v1Client.createSite.mockRejectedValueOnce(new GscdumpV1Error({
      code: 'invalid_request',
      status: 409,
      message: 'The free allowance covers 3 Sites. Disconnect a Site, or use Local mode for more Sites.',
      retryable: false,
      details: { reason: 'site_allowance', limit: 3 },
    }))

    const result = await useGscdumpClient().registerSite({ userId: 'u_1', requestedUrl: 'example.com' })

    expect(result).toEqual({ _tag: 'Refused', refusal: { reason: 'site_allowance', limit: 3 } })
  })
})
