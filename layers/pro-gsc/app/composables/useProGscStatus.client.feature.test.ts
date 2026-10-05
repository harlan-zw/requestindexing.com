import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const lifecycle = vi.hoisted(() => ({ read: vi.fn(), site: null as unknown as Ref<{ publicId: string, gscdumpSiteId: string, gscdumpSiteUrl: string }> }))

vi.mock('#layers/pro-saas/app/composables/useProSiteInjection', () => ({
  useProSiteInjection: () => ({ site: lifecycle.site }),
}))

Object.assign(globalThis, { useProFetch: () => lifecycle.read })

const { useProGscStatus } = await import('./useProGscStatus')

beforeEach(() => {
  lifecycle.read.mockReset()
  lifecycle.site = ref({ publicId: 'ri_1', gscdumpSiteId: 's_linked', gscdumpSiteUrl: 'sc-domain:example.com' })
})

describe('useProGscStatus', () => {
  it('exposes the authoritative indexing phase independently of completed task progress', async () => {
    lifecycle.read.mockResolvedValue({ site: {
      analytics: { status: 'queryable_live', queryable: true, sourceMode: 'live', progress: { completed: 668, failed: 0, total: 668, percent: 100 }, syncedRange: { oldest: null, newest: null } },
      indexing: { status: 'waiting_for_sitemaps', progress: { completed: 1, failed: 0, total: 1, percent: 100 } },
      sitemaps: { status: 'discovering' },
      latestError: null,
      hold: null,
    } })
    const status = useProGscStatus('ri_1')
    await status.refresh()
    expect(status.data.value).toMatchObject({ indexingStatus: 'waiting_for_sitemaps', indexing: { completed: 1, total: 1 } })
  })

  it('does not retain another Site status when the new Site read fails', async () => {
    lifecycle.read.mockResolvedValueOnce({ site: {
      analytics: { status: 'ready', queryable: true, sourceMode: 'server', progress: { completed: 1, failed: 0, total: 1, percent: 100 }, syncedRange: { oldest: null, newest: null } },
      indexing: { status: 'idle', progress: { completed: 0, failed: 0, total: 0, percent: 0 } },
      sitemaps: { status: 'idle' },
      latestError: null,
      hold: null,
    } }).mockRejectedValueOnce(new Error('Unavailable'))
    const status = useProGscStatus('ri_1')
    await status.refresh()
    lifecycle.site.value.gscdumpSiteId = 's_other'
    await status.refresh()
    expect(status.isReady.value).toBe(false)
    expect(status.data.value?.syncProgress).toBe(null)
    expect(status.hasError.value).toBe(true)
  })

  it('ignores a late failure from an older lifecycle read', async () => {
    let rejectRead!: (error: Error) => void
    lifecycle.read.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectRead = reject
    }))
      .mockResolvedValueOnce({ site: null })
    const status = useProGscStatus('ri_1')
    const older = status.refresh()
    await status.refresh()
    rejectRead(new Error('Older read failed'))
    await older
    expect(status.hasError.value).toBe(false)
    expect(status.fetchStatus.value).toBe('success')
  })

  it('keeps readable import progress after a failed lifecycle poll and recovers', async () => {
    const site = {
      analytics: { status: 'queryable_partial', queryable: true, sourceMode: 'server', progress: { completed: 7, failed: 0, total: 668, percent: 1 }, syncedRange: { oldest: null, newest: null } },
      indexing: { status: 'idle', progress: { completed: 0, failed: 0, total: 0, percent: 0 } },
      sitemaps: { status: 'idle' },
      latestError: null,
      hold: null,
    }
    lifecycle.read.mockResolvedValueOnce({ site })
      .mockRejectedValueOnce(new Error('Lifecycle unavailable'))
      .mockResolvedValueOnce({ site: { ...site, analytics: { ...site.analytics, status: 'ready', progress: { completed: 668, failed: 0, total: 668, percent: 100 } } } })
    const status = useProGscStatus('ri_1')
    await status.refresh()
    await status.refresh()
    expect(status.hasError.value).toBe(true)
    expect(status.isReady.value).toBe(true)
    expect(status.isProcessing.value).toBe(true)
    expect(status.data.value?.syncProgress).toEqual({ percent: 1, completed: 7, total: 668 })
    await status.refresh()
    expect(status.hasError.value).toBe(false)
    expect(status.isFullySynced.value).toBe(true)
    expect(status.isProcessing.value).toBe(false)
  })

  // A failed read says nothing about the link. Reading it as "not connected"
  // put the sample overlay and its connect button on a linked Site (UX replay A5).
  it('keeps a linked Site connected when the lifecycle read fails', async () => {
    lifecycle.read.mockRejectedValue(Object.assign(new Error('Not registered with gscdump'), { statusCode: 400 }))
    const status = useProGscStatus('ri_1')
    await status.refresh()
    expect(status.hasError.value).toBe(true)
    expect(status.isNotConnected.value).toBe(false)
    expect(status.isLifecycleSettled.value).toBe(true)
  })

  it('settles when the lifecycle does not list the Site', async () => {
    lifecycle.read.mockResolvedValue({ site: null })
    const status = useProGscStatus('ri_1')
    expect(status.isLifecycleSettled.value).toBe(false)
    await status.refresh()
    expect(status.isLifecycleSettled.value).toBe(true)
    expect(status.isProcessing.value).toBe(false)
  })

  it('does not call a readable one-percent import complete', async () => {
    lifecycle.read.mockResolvedValue({ site: {
      analytics: { status: 'queryable_partial', queryable: true, sourceMode: 'server', progress: { completed: 7, failed: 0, total: 668, percent: 1 }, syncedRange: { oldest: null, newest: null } },
      indexing: { status: 'idle', progress: { completed: 0, failed: 0, total: 0, percent: 0 } },
      sitemaps: { status: 'idle' },
      latestError: null,
      hold: null,
    } })
    const status = useProGscStatus('ri_1')
    await status.refresh()
    expect(status.isReady.value).toBe(true)
    expect(status.isFullySynced.value).toBe(false)
    expect(status.isProcessing.value).toBe(true)
    expect(status.data.value?.syncStatus).toBe('syncing')
    expect(status.data.value?.syncProgress).toEqual({ percent: 1, completed: 7, total: 668 })
  })

  it('waits for readable data even after sixty tasks finish', async () => {
    lifecycle.read.mockResolvedValue({ site: {
      analytics: { status: 'syncing', queryable: false, sourceMode: 'none', progress: { completed: 60, failed: 0, total: 668, percent: 9 }, syncedRange: { oldest: null, newest: null } },
      indexing: { status: 'idle', progress: { completed: 0, failed: 0, total: 0, percent: 0 } },
      sitemaps: { status: 'idle' },
      latestError: null,
      hold: null,
    } })
    const status = useProGscStatus('ri_1')
    await status.refresh()
    expect(status.isReady.value).toBe(false)
    expect(status.isFullySynced.value).toBe(false)
    expect(status.isProcessing.value).toBe(true)
  })
})
