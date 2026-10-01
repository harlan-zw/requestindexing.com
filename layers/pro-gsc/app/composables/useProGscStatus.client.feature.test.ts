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
})
