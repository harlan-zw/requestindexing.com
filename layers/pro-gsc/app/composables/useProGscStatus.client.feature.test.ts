import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const lifecycle = vi.hoisted(() => ({ read: vi.fn() }))

vi.mock('#layers/pro-saas/app/composables/useProSiteInjection', () => ({
  useProSiteInjection: () => ({ site: ref({ publicId: 'ri_1', gscdumpSiteId: 's_linked', gscdumpSiteUrl: 'sc-domain:example.com' }) }),
}))

Object.assign(globalThis, { useProFetch: () => lifecycle.read })

const { useProGscStatus } = await import('./useProGscStatus')

beforeEach(() => {
  lifecycle.read.mockReset()
})

describe('useProGscStatus', () => {
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
