import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSite } from './useSite'

const lifecycle = vi.hoisted(() => ({ refresh: vi.fn() }))
const failed = ref(true)
vi.mock('#layers/pro-gsc/app/composables/useProGscStatus', () => ({
  useProGscStatus: () => ({ hasError: failed, refresh: lifecycle.refresh }),
}))
vi.mock('./useProSiteInjection', () => ({
  useProSiteInjection: () => ({ site: ref({ url: 'https://example.com', gscdumpSiteId: 's_engine' }), siteStatus: ref('success') }),
}))
Object.assign(globalThis, { useRoute: () => ({ params: { id: 's_app' } }) })
describe('site lifecycle failure', () => {
  it('lets a page show and retry the lifecycle failure', async () => {
    const site = useSite()
    expect(site.gscStatusError.value).toBe(true)
    await site.refreshGscStatus()
    expect(lifecycle.refresh).toHaveBeenCalledOnce()
  })
})
