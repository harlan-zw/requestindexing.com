import type { H3Event } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { forgetGscdumpAccountStatus, readGscdumpAccountStatus, rememberGscdumpAccountStatus } from './gscdump-account-status'

const upstream = vi.hoisted(() => vi.fn())
vi.mock('./gscdump-client', () => ({ RENDER_PATH_TIMEOUT_MS: 2500, useGscdumpClient: () => ({ getUserLifecycle: upstream }) }))
vi.mock('~~/shared/server/logger', () => ({ logger: { error: vi.fn() } }))
let sequence = 0
let id: string
let values: Map<string, unknown>
let get: ReturnType<typeof vi.fn>
let put: ReturnType<typeof vi.fn>
let remove: ReturnType<typeof vi.fn>
let background: Promise<unknown>[]
let releases: Array<() => void>
let event: H3Event
const ready = (status = 'ready') => ({ account: { status } })
function held<T>() {
  let finish!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    finish = resolve
  })
  return { promise, finish }
}
async function settle() {
  await vi.advanceTimersByTimeAsync(0)
}
beforeEach(() => {
  vi.useFakeTimers()
  id = `u_test_${++sequence}`
  values = new Map()
  background = []
  releases = []
  get = vi.fn(async (key: string) => values.get(key) ?? null)
  put = vi.fn(async (key: string, value: unknown) => {
    values.set(key, value)
  })
  remove = vi.fn(async (key: string) => {
    values.delete(key)
  })
  event = { waitUntil: (promise: Promise<unknown>) => {
    background.push(promise)
  } } as unknown as H3Event
  vi.stubGlobal('useStorage', () => ({ getItem: get, setItem: put, removeItem: remove }))
  upstream.mockReset().mockResolvedValue(ready())
})
afterEach(async () => {
  releases.forEach(release => release())
  await settle()
  await Promise.all(background)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('limits a cache miss read to 250 ms and ignores its late cached answer', async () => {
  const cached = held<unknown>()
  get.mockReturnValueOnce(cached.promise)
  releases.push(() => cached.finish({ _tag: 'Read', status: 'scope_missing', readAt: Date.now() }))
  let output: unknown
  const read = readGscdumpAccountStatus(id, event).then((value) => {
    output = value
  })
  await vi.advanceTimersByTimeAsync(249)
  expect(output).toBeUndefined()
  await vi.advanceTimersByTimeAsync(1)
  expect(output).toBe('ready')
  await read
  cached.finish({ _tag: 'Read', status: 'scope_missing', readAt: Date.now() })
  await settle()
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ _tag: 'Read', status: 'ready' })
})
it('returns fresh status while the runtime retains a slow cache write', async () => {
  const written = held<void>()
  put.mockImplementationOnce(async (key: string, value: unknown) => {
    await written.promise
    values.set(key, value)
  })
  releases.push(() => written.finish())
  let output: unknown
  const read = readGscdumpAccountStatus(id, event).then((value) => {
    output = value
  })
  await settle()
  expect(output).toBe('ready')
  expect(background).toHaveLength(1)
  expect(values.size).toBe(0)
  written.finish()
  await Promise.all(background)
  await read
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ _tag: 'Read', status: 'ready' })
})
it('joins concurrent same-account reads without sharing other accounts', async () => {
  const response = held<ReturnType<typeof ready>>()
  upstream.mockReturnValueOnce(response.promise)
  releases.push(() => response.finish(ready()))
  const first = readGscdumpAccountStatus(id, event)
  const second = readGscdumpAccountStatus(id, event)
  await settle()
  expect(upstream).toHaveBeenCalledOnce()
  expect(await readGscdumpAccountStatus('u_other', event)).toBe('ready')
  expect(upstream).toHaveBeenCalledTimes(2)
  response.finish(ready('scope_missing'))
  expect(await first).toBe('scope_missing')
  expect(await second).toBe('scope_missing')
})
it('retires a late cached result before a confirmed fresh status write', async () => {
  const cached = held<unknown>()
  get.mockReturnValueOnce(cached.promise)
  releases.push(() => cached.finish(null))
  const former = readGscdumpAccountStatus(id, event)
  await settle()
  await rememberGscdumpAccountStatus(id, 'scope_missing')
  cached.finish({ _tag: 'Read', status: 'ready', readAt: Date.now() })
  expect(await former).toBeNull()
  expect(upstream).not.toHaveBeenCalled()
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ status: 'scope_missing' })
})
it('orders invalidation after a detached write before confirming removal', async () => {
  const written = held<void>()
  put.mockImplementationOnce(async (key: string, value: unknown) => {
    await written.promise
    values.set(key, value)
  })
  releases.push(() => written.finish())
  let output: unknown
  void readGscdumpAccountStatus(id, event).then((value) => {
    output = value
  })
  await settle()
  expect(output).toBe('ready')
  const invalidated = forgetGscdumpAccountStatus(id)
  await settle()
  expect(remove).not.toHaveBeenCalled()
  written.finish()
  await invalidated
  expect(values.has(`gscdump-account-status:${id}`)).toBe(false)
})
it('does not publish a former upstream answer after invalidation completes', async () => {
  const response = held<ReturnType<typeof ready>>()
  upstream.mockReturnValueOnce(response.promise)
  releases.push(() => response.finish(ready()))
  const former = readGscdumpAccountStatus(id, event)
  await settle()
  await forgetGscdumpAccountStatus(id)
  response.finish(ready('scope_missing'))
  expect(await former).toBeNull()
  expect(put).not.toHaveBeenCalled()
  expect(await readGscdumpAccountStatus(id, event)).toBe('ready')
})
it('retires reads started while an authoritative mutation is still pending', async () => {
  const written = held<void>()
  put.mockImplementationOnce(async (key: string, value: unknown) => {
    await written.promise
    values.set(key, value)
  })
  releases.push(() => written.finish())
  const mutation = rememberGscdumpAccountStatus(id, 'scope_missing')
  await settle()
  const response = held<ReturnType<typeof ready>>()
  upstream.mockReturnValueOnce(response.promise)
  releases.push(() => response.finish(ready()))
  const concurrent = readGscdumpAccountStatus(id, event)
  await settle()
  expect(get).not.toHaveBeenCalled()
  written.finish()
  await mutation
  response.finish(ready())
  expect(await concurrent).toBeNull()
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ status: 'scope_missing' })
})
it('keeps an authoritative replacement after an older detached write settles', async () => {
  const written = held<void>()
  put.mockImplementationOnce(async (key: string, value: unknown) => {
    await written.promise
    values.set(key, value)
  })
  releases.push(() => written.finish())
  upstream.mockResolvedValueOnce(ready('scope_missing'))
  expect(await readGscdumpAccountStatus(id, event)).toBe('scope_missing')
  const readAt = Date.now()
  const replacement = rememberGscdumpAccountStatus(id, 'ready')
  await settle()
  expect(put).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(5000)
  written.finish()
  await replacement
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ status: 'ready', readAt })
})
it('keeps fresh status when optional storage rejects or throws', async () => {
  get.mockRejectedValueOnce(new Error('Synthetic cache outage'))
  put.mockRejectedValueOnce(new Error('Synthetic write outage'))
  expect(await readGscdumpAccountStatus(id, event)).toBe('ready')
  await Promise.all(background)
  expect(values.size).toBe(0)
  vi.stubGlobal('useStorage', () => {
    throw new Error('Synthetic missing binding')
  })
  expect(await readGscdumpAccountStatus(id, event)).toBe('ready')
  await Promise.all(background)
})
it('retains successful 10 minute and failed 60 second freshness semantics', async () => {
  await rememberGscdumpAccountStatus(id, 'scope_missing')
  expect(await readGscdumpAccountStatus(id, event)).toBe('scope_missing')
  expect(upstream).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(600001)
  upstream.mockRejectedValueOnce(new Error('Synthetic outage'))
  expect(await readGscdumpAccountStatus(id, event)).toBeNull()
  await Promise.all(background)
  expect(values.get(`gscdump-account-status:${id}`)).toMatchObject({ _tag: 'Failed' })
  await vi.advanceTimersByTimeAsync(60000)
  expect(await readGscdumpAccountStatus(id, event)).toBeNull()
  expect(upstream).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  expect(await readGscdumpAccountStatus(id, event)).toBe('ready')
  expect(upstream).toHaveBeenCalledTimes(2)
})
