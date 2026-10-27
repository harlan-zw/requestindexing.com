import { useEventListener, useIntervalFn } from '@vueuse/core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, onScopeDispose, reactive, ref, shallowRef, toValue, watch } from 'vue'
import { useGscQuery } from '../app/composables/useGscQuery'
import plugin from '../app/plugins/gscdump-auth.client'

vi.hoisted(() => {
  Object.assign(globalThis, { defineNuxtPlugin: (plugin: unknown) => plugin })
})
const startPlugin = () => (plugin as unknown as { setup: () => unknown }).setup()

let scope: ReturnType<typeof effectScope>
let integration: ReturnType<typeof shallowRef>
let route: { path: string, fullPath: string }
let fetch: ReturnType<typeof vi.fn>
let clear: ReturnType<typeof vi.fn<() => Promise<void>>>
let navigate: ReturnType<typeof vi.fn>
let states: Map<string, unknown>
let session: ReturnType<typeof ref<{ user?: { id: number } }>>

async function settle() {
  for (let index = 0; index < 10; index++) await nextTick()
}
beforeEach(() => {
  scope = effectScope()
  integration = shallowRef(null)
  route = reactive({ path: '/pro/dashboard/sites/s_one/search-console', fullPath: '/pro/dashboard/sites/s_one/search-console' })
  fetch = vi.fn()
  session = ref({ user: { id: 7 } })
  clear = vi.fn(async () => {
    session.value = {}
  })
  navigate = vi.fn(async () => {})
  states = new Map()
  Object.assign(globalThis, { computed, ref, shallowRef, watch, toValue, onScopeDispose, useEventListener, useIntervalFn })
  vi.stubGlobal('$fetch', fetch)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useNuxtData', () => ({ data: integration }))
  vi.stubGlobal('useUserSession', () => ({ session, loggedIn: computed(() => !!session.value?.user), clear }))
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
    if (!states.has(key))
      states.set(key, ref(initialize()))
    return states.get(key)
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  scope.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('mounts a current chart while optional integration metadata is still pending', async () => {
  let release!: (value: unknown) => void
  fetch.mockReturnValue(new Promise((resolve) => {
    release = resolve
  }))
  const read = vi.fn(async () => ({ rows: [{ clicks: 9 }] }))
  let view: ReturnType<typeof useGscQuery> | undefined
  const boot = Promise.resolve(scope.run(startPlugin))
    .then(() => {
      view = scope.run(() => useGscQuery({ site: 's_one', params: { type: 'data-detail' }, identityScope: 'sealed-session', serverFallback: read }))
    })
  await settle()
  expect(read).toHaveBeenCalledOnce()
  expect(view?.data.value).toEqual({ rows: [{ clicks: 9 }] })
  expect(integration.value).toBeNull()
  expect(fetch).toHaveBeenCalledOnce()
  release({ connected: true, browserAnalyzerEnabled: false })
  await boot
  await settle()
  expect(integration.value).toEqual({ connected: true, browserAnalyzerEnabled: false })
  expect(read).toHaveBeenCalledOnce()
})

it('clears an expired session once when the nonblocking metadata read returns 401', async () => {
  fetch.mockRejectedValue({ statusCode: 401 })
  scope.run(startPlugin)
  await settle()
  expect(clear).toHaveBeenCalledOnce()
  expect(navigate).toHaveBeenCalledWith({ path: '/login', query: { redirect: route.fullPath } })
  expect(integration.value).toBeNull()
})

it('fences a late integration response after the plugin scope is disposed', async () => {
  let release!: (value: unknown) => void
  fetch.mockReturnValue(new Promise((resolve) => {
    release = resolve
  }))
  scope.run(startPlugin)
  await settle()
  scope.stop()
  release({ connected: true, browserAnalyzerEnabled: true })
  await settle()
  expect(integration.value).toBeNull()
})

it('starts the first metadata read once when public navigation reaches the dashboard', async () => {
  route.path = '/'
  route.fullPath = '/'
  fetch.mockResolvedValue({ connected: true, browserAnalyzerEnabled: false })
  scope.run(startPlugin)
  await settle()
  expect(fetch).not.toHaveBeenCalled()
  route.path = '/pro/dashboard/sites'
  await settle()
  route.path = '/pro/dashboard/sites/s_one/search-console'
  await settle()
  expect(fetch).toHaveBeenCalledOnce()
})

it('does not restore integration from a held success after logout', async () => {
  let release!: (value: unknown) => void
  fetch.mockReturnValue(new Promise((resolve) => {
    release = resolve
  }))
  scope.run(startPlugin)
  await settle()
  await clear()
  route.path = '/'
  route.fullPath = '/'
  release({ connected: true, browserAnalyzerEnabled: true })
  await settle()
  expect(integration.value).toBeNull()
  expect(clear).toHaveBeenCalledOnce()
  expect(navigate).not.toHaveBeenCalled()
})

it('does not clear or redirect again when a held 401 follows logout', async () => {
  let reject!: (cause: unknown) => void
  fetch.mockReturnValue(new Promise((_, refuse) => {
    reject = refuse
  }))
  scope.run(startPlugin)
  await settle()
  await clear()
  route.path = '/'
  route.fullPath = '/'
  reject({ statusCode: 401 })
  await settle()
  expect(clear).toHaveBeenCalledOnce()
  expect(navigate).not.toHaveBeenCalled()
})

it('retires integration immediately and reads the new signed-in principal once', async () => {
  fetch.mockResolvedValueOnce({ connected: true, browserAnalyzerEnabled: true })
    .mockResolvedValueOnce({ connected: false, browserAnalyzerEnabled: false })
  scope.run(startPlugin)
  await settle()
  expect(integration.value).toMatchObject({ connected: true })
  session.value = { user: { id: 8 } }
  expect(integration.value).toBeNull()
  await settle()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(integration.value).toEqual({ connected: false, browserAnalyzerEnabled: false })
})

it('preserves navigation that happens while the current expired session is being cleared', async () => {
  let finishClear!: () => void
  clear.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      finishClear = resolve
    })
    session.value = {}
  })
  fetch.mockRejectedValue({ statusCode: 401 })
  scope.run(startPlugin)
  await settle()
  expect(clear).toHaveBeenCalledOnce()
  route.path = '/'
  route.fullPath = '/'
  finishClear()
  await settle()
  expect(navigate).not.toHaveBeenCalled()
})

it('coalesces a principal round trip without reviving the old pending read', async () => {
  let release!: (value: unknown) => void
  fetch.mockReturnValueOnce(new Promise((resolve) => {
    release = resolve
  })).mockResolvedValueOnce({ connected: false, browserAnalyzerEnabled: false })
  scope.run(startPlugin)
  await settle()
  session.value = { user: { id: 8 } }
  session.value = { user: { id: 7 } }
  await settle()
  expect(fetch).toHaveBeenCalledTimes(2)
  release({ connected: true, browserAnalyzerEnabled: true })
  await settle()
  expect(integration.value).toEqual({ connected: false, browserAnalyzerEnabled: false })
})
