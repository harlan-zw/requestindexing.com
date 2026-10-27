import type { H3Event } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadGscdumpSettings, patchGscdumpSettings } from './gscdump-proxy'

vi.mock('./gscdump-origin', () => ({ getGscdumpApiUrl: () => 'https://gscdump.test/api' }))

let values: Map<string, string>
let get: ReturnType<typeof vi.fn>
let put: ReturnType<typeof vi.fn>
let remove: ReturnType<typeof vi.fn>
let upstream: ReturnType<typeof vi.fn>
let event: H3Event

beforeEach(() => {
  vi.useFakeTimers()
  values = new Map()
  get = vi.fn(async (key: string) => values.get(key) ?? null)
  put = vi.fn(async (key: string, value: string) => {
    values.set(key, value)
  })
  remove = vi.fn(async (key: string) => {
    values.delete(key)
  })
  upstream = vi.fn(async () => ({ browserAnalyzerEnabled: false }))
  event = { context: { cloudflare: { env: { KV: { get, put, delete: remove } } } } } as unknown as H3Event
  vi.stubGlobal('$fetch', upstream)
  vi.stubGlobal('createError', (error: unknown) => error)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.clearAllTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each([false, true])('retains a valid %s preference and its existing 60 second cache', async (enabled) => {
  upstream.mockResolvedValue({ browserAnalyzerEnabled: enabled })
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: enabled })
  expect(put).toHaveBeenCalledWith('gsc:settings:7', JSON.stringify({ browserAnalyzerEnabled: enabled }), { expirationTtl: 60 })
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: enabled })
  expect(upstream).toHaveBeenCalledOnce()
})

it('does not enable the browser analyzer without a credential', async () => {
  expect(await loadGscdumpSettings(event, 7, null)).toEqual({ browserAnalyzerEnabled: false })
  expect(get).not.toHaveBeenCalled()
  expect(upstream).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
})

it('releases an unanswered settings read at 800 ms and never caches its late response', async () => {
  let release!: (value: unknown) => void
  upstream.mockReturnValue(new Promise((resolve) => {
    release = resolve
  }))
  let settled = false
  const read = loadGscdumpSettings(event, 7, 'test-key').then((value) => {
    settled = true
    return value
  })
  await vi.advanceTimersByTimeAsync(799)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(settled).toBe(true)
  expect(await read).toEqual({ browserAnalyzerEnabled: false })
  release({ browserAnalyzerEnabled: true })
  await vi.advanceTimersByTimeAsync(0)
  expect(put).not.toHaveBeenCalled()
})

it('does not start upstream work when a delayed KV read outlives the budget', async () => {
  let release!: (value: null) => void
  get.mockReturnValue(new Promise((resolve) => {
    release = resolve
  }))
  let settled = false
  const read = loadGscdumpSettings(event, 7, 'test-key').then((value) => {
    settled = true
    return value
  })
  await vi.advanceTimersByTimeAsync(800)
  expect(settled).toBe(true)
  expect(await read).toEqual({ browserAnalyzerEnabled: false })
  release(null)
  await vi.advanceTimersByTimeAsync(0)
  expect(upstream).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
})

it('returns a conservative fallback on storage failure without starting another read', async () => {
  get.mockRejectedValue(new Error('Synthetic storage failure'))
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
  expect(upstream).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
})

it('does not cache a failed upstream read before a healthy opt-out can be read', async () => {
  upstream.mockRejectedValueOnce(new Error('Synthetic503'))
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
  expect(put).not.toHaveBeenCalled()
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
  expect(upstream).toHaveBeenCalledTimes(2)
  expect(put).toHaveBeenCalledOnce()
})

it.each([null, {}, { browserAnalyzerEnabled: 'false' }])('rejects malformed upstream preferences as a fallback', async (value) => {
  upstream.mockResolvedValue(value)
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
  expect(put).not.toHaveBeenCalled()
})

it.each(['{', '{"browserAnalyzerEnabled":"false"}'])('replaces malformed cached values with a valid upstream preference', async (value) => {
  values.set('gsc:settings:7', value)
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
  expect(upstream).toHaveBeenCalledOnce()
  expect(values.get('gsc:settings:7')).toBe('{"browserAnalyzerEnabled":false}')
})

it('keeps the valid cache write ordered before the read resolves', async () => {
  let release!: () => void
  put.mockImplementation(async (key: string, value: string) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    values.set(key, value)
  })
  let settled = false
  const read = loadGscdumpSettings(event, 7, 'test-key').then((value) => {
    settled = true
    return value
  })
  await vi.advanceTimersByTimeAsync(800)
  expect(settled).toBe(false)
  release()
  expect(await read).toEqual({ browserAnalyzerEnabled: false })
  expect(values.get('gsc:settings:7')).toBe('{"browserAnalyzerEnabled":false}')
})

it('keeps PATCH and invalidation authoritative for the next settings read', async () => {
  values.set('gsc:settings:7', '{"browserAnalyzerEnabled":true}')
  expect(await patchGscdumpSettings(event, 7, 'test-key', { browserAnalyzerEnabled: false })).toEqual({ browserAnalyzerEnabled: false })
  expect(remove).toHaveBeenCalledWith('gsc:settings:7')
  expect(values.has('gsc:settings:7')).toBe(false)
  expect(await loadGscdumpSettings(event, 7, 'test-key')).toEqual({ browserAnalyzerEnabled: false })
})
