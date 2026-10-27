import { afterEach, expect, it, vi } from 'vitest'
import { computed, createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useProGscStatus } from './useProGscStatus'

vi.mock('#layers/pro-saas/app/composables/useProSiteInjection', () => ({
  useProSiteInjection: () => ({ site: ref({ publicId: 'ri_1', gscdumpSiteId: 's_linked', gscdumpSiteUrl: 'sc-domain:example.com' }) }),
}))
vi.mock('../internal/composables/useGscInvalidation', () => ({
  useGscInvalidationMap: () => ref({}),
  useGscSiteInvalidation: () => ref(0),
}))
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('renders two server consumers without starting lifecycle reads or fallback timers', async () => {
  vi.useFakeTimers()
  const read = vi.fn()
  const nuxtApp = {}
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useProFetch', () => read)
  vi.stubGlobal('useNuxtApp', () => nuxtApp)
  vi.stubGlobal('useNuxtData', () => ({ data: ref(null) }))
  vi.stubGlobal('useUserSession', () => ({ session: ref({ user: { id: 1 } }), loggedIn: ref(true) }))
  const app = createSSRApp({ setup() {
    const first = useProGscStatus('ri_1')
    const second = useProGscStatus('ri_1')
    return () => h('main', first.isNotConnected.value || second.isNotConnected.value ? 'Connect' : 'Connected')
  } })
  expect(await renderToString(app)).toBe('<main>Connected</main>')
  await vi.advanceTimersByTimeAsync(60_000)
  expect(read).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
