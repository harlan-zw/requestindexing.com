import { useEventListener } from '@vueuse/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'

const sdk = vi.hoisted(() => ({
  loaded: vi.fn(),
  create: vi.fn(),
  start: vi.fn<() => Promise<void>>(),
  stop: vi.fn(),
  load: Promise.resolve(),
}))

vi.mock('../app/composables/useGscdumpIntegration', () => ({
  GSCDUMP_INTEGRATION_KEY: 'app:gscdump-integration',
}))

const scopes: ReturnType<typeof effectScope>[] = []

beforeEach(() => {
  vi.resetModules()
  vi.doMock('@gscdump/sdk/v1', async () => {
    sdk.loaded()
    await sdk.load
    return {
      createGscdumpV1Client: () => ({ createRealtimeTicket: vi.fn() }),
      createGscdumpRealtimeV1Client: sdk.create,
    }
  })
  vi.clearAllMocks()
  sdk.load = Promise.resolve()
  sdk.start.mockResolvedValue(undefined)
  sdk.create.mockImplementation(() => ({ start: sdk.start, stop: sdk.stop }))
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onScopeDispose', onScopeDispose)
  vi.stubGlobal('useEventListener', useEventListener)
})

afterEach(() => {
  for (const scope of scopes.splice(0))
    scope.stop()
  vi.unstubAllGlobals()
})

async function mount(path: string, connected: boolean) {
  const route = reactive({ path })
  const integration = ref({ connected })
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useNuxtData', () => ({ data: integration }))
  vi.stubGlobal('useUserSession', () => ({ user: ref({ id: 'user-7' }) }))
  const scope = effectScope()
  scopes.push(scope)
  // A fresh module graph lets each test observe the SDK import boundary.
  const plugin = (await import('../app/plugins/gscdump-realtime.client')).default
  scope.run(() => (plugin as unknown as { setup: () => void }).setup())
  return { route, integration, scope }
}

describe('dashboard realtime activation', () => {
  it('keeps the SDK unloaded on public pages and disconnected dashboards', async () => {
    await mount('/', true)
    await mount('/pro/dashboard/sites', false)
    await nextTick()

    expect(sdk.loaded).not.toHaveBeenCalled()
    expect(sdk.start).not.toHaveBeenCalled()
  })

  it('starts once when navigation reaches a connected dashboard', async () => {
    const { route } = await mount('/', true)
    route.path = '/pro/dashboard/sites'
    await vi.waitFor(() => expect(sdk.start).toHaveBeenCalledOnce())
    route.path = '/pro/dashboard/sites/site-1'
    await nextTick()

    expect(sdk.start).toHaveBeenCalledOnce()
  })

  it('cancels a pending load when the integration disconnects', async () => {
    let release!: () => void
    sdk.load = new Promise<void>((resolve) => {
      release = resolve
    })
    const { integration } = await mount('/pro/dashboard/sites', true)
    await vi.waitFor(() => expect(sdk.loaded).toHaveBeenCalledOnce())
    integration.value.connected = false
    await nextTick()
    release()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(sdk.create).not.toHaveBeenCalled()
  })

  it('cancels a pending load when the plugin scope ends', async () => {
    let release!: () => void
    sdk.load = new Promise<void>((resolve) => {
      release = resolve
    })
    const { scope } = await mount('/pro/dashboard/sites', true)
    await vi.waitFor(() => expect(sdk.loaded).toHaveBeenCalledOnce())
    scope.stop()
    release()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(sdk.create).not.toHaveBeenCalled()
  })

  it('stops a live connection when an initial dashboard scope ends', async () => {
    const { scope } = await mount('/pro/dashboard/sites', true)
    await vi.waitFor(() => expect(sdk.start).toHaveBeenCalledOnce())

    scope.stop()

    expect(sdk.stop).toHaveBeenCalledOnce()
  })

  it('starts only the latest connection after a pending disconnect and reconnect', async () => {
    let release!: () => void
    sdk.load = new Promise<void>((resolve) => {
      release = resolve
    })
    const { integration } = await mount('/pro/dashboard/sites', true)
    await vi.waitFor(() => expect(sdk.loaded).toHaveBeenCalledOnce())
    integration.value.connected = false
    await nextTick()
    integration.value.connected = true
    await nextTick()

    release()

    await vi.waitFor(() => expect(sdk.start).toHaveBeenCalledOnce())
    expect(sdk.create).toHaveBeenCalledOnce()
  })

  it('cancels a pending connection on tab unload', async () => {
    let release!: () => void
    sdk.load = new Promise<void>((resolve) => {
      release = resolve
    })
    await mount('/pro/dashboard/sites', true)
    await vi.waitFor(() => expect(sdk.loaded).toHaveBeenCalledOnce())

    window.dispatchEvent(new Event('beforeunload'))
    release()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(sdk.create).not.toHaveBeenCalled()
  })
})
