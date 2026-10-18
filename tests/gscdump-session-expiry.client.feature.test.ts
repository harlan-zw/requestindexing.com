// Actual auth/realtime plugins and HTTP/realtime SDKs; fake only browser IO.
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'

vi.mock('../layers/pro-gsc/app/composables/useGscdumpIntegration', () => ({
  GSCDUMP_INTEGRATION_KEY: 'app:gscdump-integration',
}))

const START = Date.parse('2026-10-18T00:00:00Z')
const stream = { streamId: 'user:u_synthetic', sequence: '0' }
let sockets: SyntheticSocket[]
let scopes: ReturnType<typeof effectScope>[]
let ticketFetch: ReturnType<typeof vi.fn>
let authFetch: ReturnType<typeof vi.fn>
let resync: ReturnType<typeof vi.fn>
let warning: ReturnType<typeof vi.spyOn>
let clearSession: ReturnType<typeof vi.fn>
let navigate: ReturnType<typeof vi.fn>

class SyntheticSocket {
  protocol = 'gscdump.v1'
  readyState = 1
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  closes: number[] = []
  pings = 0
  createdAt = Date.now()
  constructor() {
    sockets.push(this)
    queueMicrotask(() => this.onopen?.({}))
  }

  send(data: string) {
    if (data === 'ping') {
      this.pings++
      queueMicrotask(() => this.onmessage?.({ data: 'pong' }))
      return
    }
    if (JSON.parse(data).type === 'hello') {
      const ready = {
        type: 'ready',
        protocolVersion: 1,
        connectionId: 'conn_synthetic',
        streamId: stream.streamId,
        replayFloor: stream,
        head: stream,
        limits: { maxBatchEvents: 20, maxUnackedEvents: 500 },
        heartbeat: { ping: 'ping', pong: 'pong' },
        expiresAt: new Date(this.createdAt + 900_000).toISOString(),
      }
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(ready) }))
    }
  }

  close(code: number) {
    this.readyState = 3
    this.closes.push(code)
    this.onclose?.({ code })
  }
}

async function flush() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(START)
  sockets = []
  scopes = []
  localStorage.clear()
  localStorage.setItem('requestindexing:gscdump:v1:cursor:synthetic-user', JSON.stringify(stream))
  warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  ticketFetch = vi.fn(async () => new Response(JSON.stringify({
    data: {
      socketUrl: 'wss://example.test/ws/v1',
      protocol: 'gscdump.v1',
      protocolVersion: 1,
      ticket: 'gscdump.ticket.v1.synthetic.payload',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      head: stream,
      maxConnectionSeconds: 900,
    },
    meta: { requestId: 'req_synthetic', surface: 'realtime', version: '1.0' },
  }), { status: 201, headers: { 'content-type': 'application/json' } }))
  authFetch = vi.fn(async () => ({ connected: true, browserAnalyzerEnabled: true }))
  resync = vi.fn(async () => {})
  clearSession = vi.fn(async () => {})
  navigate = vi.fn(async () => {})
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('fetch', ticketFetch)
  vi.stubGlobal('$fetch', authFetch)
  vi.stubGlobal('WebSocket', SyntheticSocket)
  vi.stubGlobal('refreshNuxtData', resync)
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onScopeDispose', onScopeDispose)
  vi.stubGlobal('useEventListener', useEventListener)
  vi.stubGlobal('useIntervalFn', useIntervalFn)
})

afterEach(() => {
  scopes.forEach(scope => scope.stop())
  warning.mockRestore()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function mount() {
  const integration = ref({ connected: true, browserAnalyzerEnabled: true })
  const states = new Map()
  const route = reactive({ path: '/pro/dashboard/sites/site-synthetic/indexing', fullPath: '/pro/dashboard/sites/site-synthetic/indexing' })
  const app: Record<string, unknown> = {}
  vi.stubGlobal('useNuxtApp', () => app)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useNuxtData', () => ({ data: integration }))
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key))
      states.set(key, ref(init()))
    return states.get(key)
  })
  vi.stubGlobal('useUserSession', () => ({ user: ref({ id: 'synthetic-user' }), clear: clearSession }))
  const scope = effectScope()
  scopes.push(scope)
  const auth = (await import('../layers/pro-gsc/app/plugins/gscdump-auth.client')).default
  const realtime = (await import('../layers/pro-gsc/app/plugins/gscdump-realtime.client')).default
  const result = await scope.run(() => (auth as unknown as { setup: () => Promise<{ provide: Record<string, unknown> }> }).setup())
  for (const [key, value] of Object.entries(result?.provide ?? {})) app[`$${key}`] = value
  scope.run(() => (realtime as unknown as { setup: () => void }).setup())
  // Dynamic import needs the host event loop, not just fake timer advancement.
  await vi.waitFor(() => expect(ticketFetch).toHaveBeenCalled(), { timeout: 5_000 })
  await flush()
  return { integration, states, scope }
}

const host401 = () => Object.assign(new Error('Synthetic expired host session'), { status: 401 })

function ticketError(status: number, code: string, retryable: boolean) {
  return new Response(JSON.stringify({ error: { code, message: 'Synthetic ticket rejection', retryable, requestId: 'req_synthetic', details: {} } }), { status, headers: { 'content-type': 'application/json' } })
}

describe('host session and realtime ticket recovery', () => {
  it('invalidates authoritative host401, stops realtime, and uses the login flow once', async () => {
    const { integration } = await mount()
    authFetch.mockRejectedValue(host401())
    window.dispatchEvent(new Event('focus'))
    await flush()
    window.dispatchEvent(new Event('focus'))
    await flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(integration.value).toBeNull()
    expect(sockets[0]!.closes).toHaveLength(1)
    expect(ticketFetch).toHaveBeenCalledOnce()
    expect(clearSession).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ path: '/login', query: { redirect: '/pro/dashboard/sites/site-synthetic/indexing' } })
  })

  it('stops a ticket401 loop and confirms the host session before choosing login', async () => {
    ticketFetch.mockResolvedValue(new Response(JSON.stringify({ statusCode: 401, message: 'Synthetic expired host session' }), { status: 401 }))
    authFetch.mockRejectedValue(host401())
    const { integration } = await mount()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ticketFetch).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledOnce()
    expect(integration.value).toBeNull()
    expect(clearSession).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
    expect(warning.mock.calls.filter((call: unknown[]) => String(call[0]).includes('stage=ticket'))).toHaveLength(1)
  })

  it('retries session expiry after a failed clear while deduplicating an in-flight clear', async () => {
    let rejectClear!: (error: Error) => void
    clearSession.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => rejectClear = reject))
    const { integration } = await mount()
    authFetch.mockRejectedValue(host401())
    window.dispatchEvent(new Event('focus'))
    await flush()
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(clearSession).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledOnce()

    rejectClear(new TypeError('Synthetic session-clear network interruption'))
    await flush()
    expect(integration.value).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(clearSession).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ path: '/login', query: { redirect: '/pro/dashboard/sites/site-synthetic/indexing' } })
    expect(ticketFetch).toHaveBeenCalledOnce()
  })

  it.each([401, 403])('stops permanent ticket%s without logging out a valid host session', async (status) => {
    ticketFetch.mockImplementation(async () => ticketError(status, status === 401 ? 'unauthorized' : 'forbidden', false))
    const { integration } = await mount()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ticketFetch).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
    expect(integration.value.connected).toBe(true)
    expect(clearSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledOnce()
    expect(warning.mock.calls[0]![0]).toContain(`status=${status}`)
  })

  it.each(['503', 'network'])('recovers transient ticket%s without invalidating auth', async (failure) => {
    if (failure === '503')
      ticketFetch.mockImplementationOnce(async () => ticketError(503, 'realtime_unavailable', true))
    else ticketFetch.mockRejectedValueOnce(new TypeError('Synthetic network interruption'))
    const { integration } = await mount()
    await vi.advanceTimersByTimeAsync(10_000)
    await flush()
    expect(ticketFetch).toHaveBeenCalledTimes(2)
    expect(sockets).toHaveLength(1)
    expect(integration.value.connected).toBe(true)
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each([503, 403, 'network'])('retains connected state after host probe%s and recovers on the next focus', async (status) => {
    const { integration } = await mount()
    authFetch.mockRejectedValueOnce(status === 'network' ? new TypeError('Synthetic network interruption') : Object.assign(new Error('Synthetic probe failure'), { status }))
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(integration.value.connected).toBe(true)
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(integration.value.connected).toBe(true)
    expect(sockets).toHaveLength(1)
    expect(sockets[0]!.closes).toHaveLength(0)
    expect(clearSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['old401', 'oldDisconnected'])('ignores %s arriving after a newer successful refresh', async (older) => {
    const { integration, states } = await mount()
    let oldResolve!: (value: unknown) => void
    let oldReject!: (error: Error) => void
    authFetch.mockImplementationOnce(() => new Promise((resolve, reject) => {
      oldResolve = resolve
      oldReject = reject
    }))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    await flush()
    if (older === 'old401')
      oldReject(host401())
    else oldResolve({ connected: false, browserAnalyzerEnabled: true })
    await flush()
    expect(integration.value.connected).toBe(true)
    expect(states.get('app:gscdump-integration:status').value).toBe('success')
    expect(states.get('app:gscdump-integration:error').value).toBeNull()
    expect(sockets[0]!.closes).toHaveLength(0)
    expect(clearSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not let an older success restore integration after a newer host401', async () => {
    const { integration } = await mount()
    let oldResolve!: (value: unknown) => void
    authFetch.mockImplementationOnce(() => new Promise(resolve => oldResolve = resolve))
    authFetch.mockRejectedValueOnce(host401())
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    await flush()
    oldResolve({ connected: true, browserAnalyzerEnabled: true })
    await flush()
    expect(integration.value).toBeNull()
    expect(clearSession).toHaveBeenCalledOnce()
    expect(sockets).toHaveLength(1)
  })

  it.each(['401', 'success'])('ignores a host%s arriving after plugin scope disposal', async (response) => {
    const { integration, scope } = await mount()
    let reject!: (error: Error) => void
    let resolve!: (value: unknown) => void
    authFetch.mockImplementationOnce(() => new Promise((a, b) => {
      resolve = a
      reject = b
    }))
    window.dispatchEvent(new Event('focus'))
    scope.stop()
    if (response === '401')
      reject(host401())
    else resolve({ connected: false, browserAnalyzerEnabled: true })
    await flush()
    expect(integration.value.connected).toBe(true)
    expect(clearSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not navigate after disposal while session clearing is pending', async () => {
    let resolve!: () => void
    clearSession.mockImplementationOnce(() => new Promise<void>(r => resolve = r))
    const { scope } = await mount()
    authFetch.mockRejectedValueOnce(host401())
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(clearSession).toHaveBeenCalledOnce()
    scope.stop()
    resolve()
    await flush()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ignores a stale ticket401 after a replacement connection has succeeded', async () => {
    let resolve!: (response: Response) => void
    ticketFetch.mockImplementationOnce(() => new Promise<Response>(r => resolve = r))
    const { integration } = await mount()
    integration.value = { connected: false, browserAnalyzerEnabled: true }
    await nextTick()
    integration.value = { connected: true, browserAnalyzerEnabled: true }
    await flush()
    expect(sockets).toHaveLength(1)
    resolve(ticketError(401, 'unauthorized', false))
    await flush()
    expect(authFetch).not.toHaveBeenCalled()
    expect(clearSession).not.toHaveBeenCalled()
    expect(sockets[0]!.closes).toHaveLength(0)
    expect(warning).not.toHaveBeenCalled()
  })

  it.each([401, 403])('can recover ticket%s on a normal focus after the permission is corrected', async (status) => {
    ticketFetch.mockImplementationOnce(async () => ticketError(status, status === 401 ? 'unauthorized' : 'forbidden', false))
    await mount()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ticketFetch).toHaveBeenCalledOnce()
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(ticketFetch).toHaveBeenCalledTimes(2)
    expect(sockets).toHaveLength(1)
    expect(clearSession).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(ticketFetch).toHaveBeenCalledTimes(2)
  })

  it('can reactivate after a permanent permission failure when integration reconnects', async () => {
    ticketFetch.mockImplementationOnce(async () => ticketError(403, 'forbidden', false))
    const { integration } = await mount()
    integration.value = { connected: false, browserAnalyzerEnabled: true }
    await nextTick()
    integration.value = { connected: true, browserAnalyzerEnabled: true }
    await flush()
    expect(ticketFetch).toHaveBeenCalledTimes(2)
    expect(sockets).toHaveLength(1)
    expect(clearSession).not.toHaveBeenCalled()
  })
})
