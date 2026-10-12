import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

const state = vi.hoisted(() => ({ refresh: vi.fn(), recover: vi.fn() }))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({ useProGscdump: () => ({ recoverSitePermission: state.recover }) }))
vi.mock('#layers/pro-saas/app/composables/useSite', () => ({ useSite: () => ({ site: { value: { gscdumpSiteId: 's_example' } } }) }))

const { default: Alert } = await import('./ProGscSyncAlert.vue')
let app: ReturnType<typeof createApp> | undefined

function mount(hasError: boolean, hasSyncError: boolean) {
  vi.stubGlobal('useProGscStatus', () => ({
    data: ref({ lastError: 'Provider rejected collection' }),
    refresh: state.refresh,
    fetchStatus: ref('success'),
    isNotConnected: ref(false),
    isTokenRevoked: ref(false),
    isPermissionLost: ref(false),
    hasError: ref(hasError),
    hasSyncError: ref(hasSyncError),
  }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(Alert, { siteId: 'local' })
  app.component('ProAlert', defineComponent({ props: ['title', 'description'], setup: (props, { slots }) => () => h('section', [h('h2', props.title), h('p', props.description), slots.default?.(), slots.action?.()]) }))
  app.component('UButton', defineComponent({ setup: (_props, { slots }) => () => h('button', slots.default?.()) }))
  app.mount(host)
  return host
}

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  state.refresh.mockReset()
  state.recover.mockReset()
  vi.unstubAllGlobals()
})

it('offers a status check when reading status fails', async () => {
  const host = mount(true, false)
  expect(host.textContent).toContain('Search Console status unavailable')
  expect(host.textContent).toContain('Retry status check')
  host.querySelector('button')!.click()
  await nextTick()
  expect(state.refresh).toHaveBeenCalledOnce()
  expect(state.recover).not.toHaveBeenCalled()
})

it('surfaces collection failure with a status refresh, without claiming a restart', async () => {
  const host = mount(false, true)
  expect(host.textContent).toContain('Search Console collection failed')
  expect(host.textContent).toContain('Provider rejected collection')
  expect(host.textContent).toContain('Refresh status')
  host.querySelector('button')!.click()
  await nextTick()
  expect(state.refresh).toHaveBeenCalledOnce()
  expect(state.recover).not.toHaveBeenCalled()
})
