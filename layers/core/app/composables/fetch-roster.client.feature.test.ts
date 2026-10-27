import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'
// @ts-expect-error Vitest resolves the installed native Nuxt export.
import { clearNuxtData, useAsyncData, useNuxtData } from '#test/nuxt-async-data'
// @ts-expect-error Vitest resolves Nuxt's installed ofetch export.
import { $fetch } from '#test/nuxt-ofetch'
// @ts-expect-error Vitest resolves the installed native Nuxt export.
import { useState } from '#test/nuxt-state'
import { fetchSites } from './fetch'

const state = vi.hoisted(() => ({ app: undefined as unknown as ReturnType<typeof fixture>, transport: vi.fn(), logout: vi.fn() }))
vi.mock('../../../../node_modules/nuxt/dist/app/nuxt.js', () => ({ useNuxtApp: () => state.app, tryUseNuxtApp: () => state.app, useRuntimeConfig: () => ({ public: {} }) }))
vi.mock('../../../../node_modules/nuxt/dist/app/components/client-only.js', () => ({ clientOnlySymbol: Symbol.for('nuxt:client-only') }))
vi.mock('../../../../node_modules/nuxt/dist/app/composables/ready.js', () => ({ onNuxtReady: () => {} }))
vi.mock('#imports', () => ({ useAsyncData: (...args: unknown[]) => useAsyncData(...args), useNuxtData, clearNuxtData, useState, useNuxtApp: () => state.app }))
vi.mock('./auth', () => ({ createLogoutHandler: () => state.logout }))
const roster = { sites: [{ siteId: 'a' }, { siteId: 'b' }] }
const session = ref({ user: { id: 1, currentTeamId: 10 } })
const loggedIn = ref(true)
function fixture(data: Record<string, unknown> = {}, payloadState: Record<string, unknown> = {}) {
  const payloadData: Record<string, unknown> = { 'app:caller': { user: { id: 1 }, currentTeamId: 10 }, ...data }
  return { payload: reactive({ data: payloadData, _errors: {} as Record<string, unknown>, state: payloadState, serverRendered: true }), static: { data: {} }, _state: {}, _asyncData: {}, _asyncDataPromises: {}, _scope: effectScope(), isHydrating: false, hook: () => () => {}, hooks: { callHook: async () => {}, hook: () => () => {} }, runWithContext: <T>(run: () => T): T => run() }
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
  session.value = { user: { id: 1, currentTeamId: 10 } }
  loggedIn.value = true
  state.transport.mockReset()
  state.logout.mockReset()
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
  vi.stubGlobal('useUserSession', () => ({ user: computed(() => session.value.user), session, loggedIn }))
  vi.stubGlobal('useNuxtData', useNuxtData)
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
it('retains the current roster after timeout, retries, and rejects the old late response', async () => {
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
  expect(query.data.value).toEqual(roster)
  const nextRoster = { sites: [{ siteId: 'c' }] }
  state.transport.mockResolvedValueOnce(nextRoster)
  await query.refresh()
  expect(query.data.value).toEqual(nextRoster)
  late.resolve(roster)
  await flush()
  expect(query.data.value).toEqual(nextRoster)
  expect(query.status.value).toBe('success')
})
it('keeps current rows with a terminal connection error', async () => {
  state.transport.mockResolvedValueOnce(roster).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const query = await fetchSites()
  await query.refresh()
  expect(query.status.value).toBe('error')
  expect(query.error.value).toBeDefined()
  expect(query.data.value).toEqual(roster)
})
it('retires retained rows when the previously confirmed Caller disappears', async () => {
  state.transport.mockResolvedValueOnce(roster).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const query = await fetchSites()
  await query.refresh()
  expect(query.data.value).toEqual(roster)
  delete state.app.payload.data['app:caller']
  expect(query.data.value).toBeUndefined()
})
it.each([401, 403, 500])('clears existing rows after HTTP %s', async (statusCode) => {
  state.transport.mockResolvedValueOnce(roster).mockRejectedValueOnce(Object.assign(new Error('Request refused'), { statusCode }))
  const query = await fetchSites()
  await query.refresh()
  expect(query.status.value).toBe('error')
  expect(query.data.value).toBeUndefined()
  state.transport.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await query.refresh()
  expect(query.data.value).toBeUndefined()
})
it.each(['user', 'team', 'logout', 'caller-team', 'caller-user'] as const)('retires rows synchronously on %s change', async (change) => {
  state.transport.mockResolvedValueOnce(roster)
  const query = await fetchSites()
  if (change === 'user')
    session.value = { user: { id: 2, currentTeamId: 10 } }
  if (change === 'team')
    session.value = { user: { id: 1, currentTeamId: 20 } }
  if (change === 'logout')
    loggedIn.value = false
  if (change === 'caller-team')
    state.app.payload.data['app:caller'] = { user: { id: 1 }, currentTeamId: 20 }
  if (change === 'caller-user')
    state.app.payload.data['app:caller'] = { user: { id: 2 }, currentTeamId: 10 }
  expect(query.data.value).toBeUndefined()
})
it('rejects a held old user read through A to B to A', async () => {
  const late = Promise.withResolvers<typeof roster>()
  state.transport.mockReturnValueOnce(late.promise)
  const older = fetchSites()
  await flush()
  session.value = { user: { id: 2, currentTeamId: 10 } }
  state.app.payload.data['app:caller'] = { user: { id: 2 }, currentTeamId: 10 }
  session.value = { user: { id: 1, currentTeamId: 10 } }
  state.app.payload.data['app:caller'] = { user: { id: 1 }, currentTeamId: 10 }
  const fresh = { sites: [{ siteId: 'fresh-a' }] }
  state.transport.mockResolvedValueOnce(fresh)
  const current = await fetchSites()
  expect(current.data.value).toEqual(fresh)
  late.resolve(roster)
  await older
  await flush()
  expect(current.data.value).toEqual(fresh)
})
it('does not republish an old user response while the next user is active', async () => {
  const late = Promise.withResolvers<typeof roster>()
  state.transport.mockReturnValueOnce(late.promise)
  const older = fetchSites()
  await flush()
  session.value = { user: { id: 2, currentTeamId: 20 } }
  state.app.payload.data['app:caller'] = { user: { id: 2 }, currentTeamId: 20 }
  late.resolve(roster)
  const query = await older
  await flush()
  expect(query.data.value).toBeUndefined()
})
it('captures the owner before the transport can change identity', async () => {
  state.transport.mockImplementationOnce(() => {
    session.value = { user: { id: 2, currentTeamId: 20 } }
    return Promise.resolve(roster)
  })
  const query = await fetchSites()
  expect(query.data.value).toBeUndefined()
})
it('does not admit an old static payload after the principal changes', async () => {
  state.transport.mockResolvedValueOnce(roster)
  await fetchSites()
  Object.assign(state.app.static.data, { sites: roster })
  session.value = { user: { id: 2, currentTeamId: 20 } }
  state.app.payload.data['app:caller'] = { user: { id: 2 }, currentTeamId: 20 }
  const fresh = { sites: [{ siteId: 'team-b' }] }
  state.transport.mockResolvedValueOnce(fresh)
  expect((await fetchSites()).data.value).toEqual(fresh)
})
it.each([true, false])('reuses the actual SSR seed when the Caller was available: %s', async (callerAvailable) => {
  vi.stubGlobal('__rosterServer', true)
  vi.stubGlobal('__rosterClient', false)
  if (!callerAvailable)
    delete state.app.payload.data['app:caller']
  state.transport.mockResolvedValueOnce(roster)
  await fetchSites()
  const payload = JSON.parse(JSON.stringify(state.app.payload))
  state.app._scope.stop()
  state.app = fixture(payload.data, payload.state)
  vi.stubGlobal('__rosterServer', false)
  vi.stubGlobal('__rosterClient', true)
  state.transport.mockClear()
  state.app.isHydrating = true
  expect((await fetchSites()).data.value).toEqual(roster)
  expect((await fetchSites()).data.value).toEqual(roster)
  expect(state.transport).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
it.each(['connection', 'server'] as const)('classifies actual ofetch %s failures without hiding the error', async (failure) => {
  const raw = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(roster), { headers: { 'content-type': 'application/json' } }))
  if (failure === 'connection')
    raw.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  else raw.mockResolvedValueOnce(new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }))
  const fetcher = $fetch.create({ baseURL: 'http://roster.fixture', retry: 0 }, { fetch: raw })
  state.transport.mockImplementation(fetcher)
  const query = await fetchSites()
  await query.refresh()
  expect(query.status.value).toBe('error')
  expect(query.error.value).toBeDefined()
  expect(query.data.value).toEqual(failure === 'connection' ? roster : undefined)
})
it('ignores an old 401 callback and preserves the current 401 logout', async () => {
  const old = Promise.withResolvers<typeof roster>()
  let oldOptions!: { onResponseError: (context: unknown) => Promise<void> }
  state.transport.mockImplementationOnce((_, options) => {
    oldOptions = options
    return old.promise
  })
  const older = fetchSites()
  await flush()
  session.value = { user: { id: 2, currentTeamId: 20 } }
  state.app.payload.data['app:caller'] = { user: { id: 2 }, currentTeamId: 20 }
  await oldOptions.onResponseError({ response: { status: 401 } })
  expect(state.logout).not.toHaveBeenCalled()
  state.transport.mockImplementationOnce(async (_, options) => {
    await options.onResponseError({ response: { status: 401 } })
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  })
  const current = await fetchSites()
  expect(state.logout).toHaveBeenCalledExactlyOnceWith(true)
  expect(current.data.value).toBeUndefined()
  old.resolve(roster)
  await older
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
