import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
// @ts-expect-error Vitest resolves the installed native Nuxt export.
import { useAsyncData } from '#test/nuxt-async-data'
import { fetchSites } from './fetch'

const state = vi.hoisted(() => ({ app: undefined as unknown as ReturnType<typeof fixture>, transport: vi.fn() }))
vi.mock('../../../../node_modules/nuxt/dist/app/nuxt.js', () => ({ useNuxtApp: () => state.app, tryUseNuxtApp: () => state.app, useRuntimeConfig: () => ({ public: {} }) }))
vi.mock('../../../../node_modules/nuxt/dist/app/components/client-only.js', () => ({ clientOnlySymbol: Symbol.for('nuxt:client-only') }))
vi.mock('../../../../node_modules/nuxt/dist/app/composables/ready.js', () => ({ onNuxtReady: () => {} }))
vi.mock('#imports', () => ({ useAsyncData: (...args: unknown[]) => useAsyncData(...args) }))
vi.mock('./auth', () => ({ createLogoutHandler: () => vi.fn() }))
const roster = { sites: [{ siteId: 'a' }, { siteId: 'b' }] }
function fixture(data: Record<string, unknown> = {}) {
  return { payload: reactive({ data, _errors: {} as Record<string, unknown>, state: {}, serverRendered: true }), static: { data: {} }, _asyncData: {}, _asyncDataPromises: {}, _scope: effectScope(), isHydrating: false, hook: () => () => {}, hooks: { callHook: async () => {}, hook: () => () => {} }, runWithContext: <T>(run: () => T): T => run() }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('The operation timed out', 'TimeoutError')), ms)
    return controller.signal
  })
  state.app = fixture()
  state.transport.mockReset()
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  vi.stubGlobal('useUserSession', () => ({ user: ref({ id: 'u_a', currentTeamId: 't_a' }) }))
  vi.stubGlobal('useRequestFetch', () => (...args: unknown[]) => state.transport(...args))
})
afterEach(() => {
  state.app._scope.stop()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function flush() {
  for (let i = 0; i < 20; i++)
    await nextTick()
}
it('releases a never-ending browser roster read after 25s', async () => {
  state.transport.mockImplementation(() => new Promise(() => {}))
  let result: Awaited<ReturnType<typeof fetchSites>> | undefined
  void fetchSites().then((value) => {
    result = value
  })
  await vi.advanceTimersByTimeAsync(24_999)
  expect(result).toBeUndefined()
  await vi.advanceTimersByTimeAsync(1)
  await flush()
  expect(result?.status.value).toBe('error')
  expect(result?.error.value).toBeDefined()
  expect(state.transport).toHaveBeenCalledTimes(1)
  expect(state.transport.mock.calls[0]?.[1].signal.aborted).toBe(true)
})
it('keeps pending data until timeout, then allows retry and rejects the old late response', async () => {
  const late = Promise.withResolvers<typeof roster>()
  state.transport.mockResolvedValueOnce(roster).mockImplementationOnce(() => late.promise)
  const query = await fetchSites()
  const pending = query.refresh()
  await vi.advanceTimersByTimeAsync(24_999)
  expect(query.data.value).toEqual(roster)
  await vi.advanceTimersByTimeAsync(1)
  await flush()
  expect(query.status.value).toBe('error')
  await pending
  expect(query.data.value).toBeUndefined()
  const nextRoster = { sites: [{ siteId: 'c' }] }
  state.transport.mockResolvedValueOnce(nextRoster)
  await query.refresh()
  expect(query.data.value).toEqual(nextRoster)
  late.resolve(roster)
  await flush()
  expect(query.data.value).toEqual(nextRoster)
  expect(query.status.value).toBe('success')
})
it('reuses the hydrated roster without adding a request or a timer', async () => {
  state.app = fixture({ sites: roster })
  state.app.isHydrating = true
  expect((await fetchSites()).data.value).toEqual(roster)
  expect((await fetchSites()).data.value).toEqual(roster)
  expect(state.transport).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
it('keeps server reads on their original lifetime and reuses one SSR result', async () => {
  vi.stubGlobal('__rosterServer', true)
  vi.stubGlobal('__rosterClient', false)
  const held = Promise.withResolvers<typeof roster>()
  state.transport.mockReturnValue(held.promise)
  let settled = false
  const pending = fetchSites().then((query) => {
    settled = true
    return query
  })
  await vi.advanceTimersByTimeAsync(30_000)
  expect(settled).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  held.resolve(roster)
  expect((await pending).data.value).toEqual(roster)
  expect((await fetchSites()).data.value).toEqual(roster)
  expect(state.transport).toHaveBeenCalledTimes(1)
  expect(state.transport.mock.calls[0]?.[1].signal).toBeUndefined()
})
