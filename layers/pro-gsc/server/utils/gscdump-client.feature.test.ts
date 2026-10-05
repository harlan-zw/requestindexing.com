import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGscdumpClient } from './gscdump-client'

// A deadline covers the request. Start the hung transport before advancing time,
// so cold SDK initialization cannot consume a real 20 ms test deadline.
let notifyFetchStarted: (() => void) | undefined
const hungFetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
  notifyFetchStarted?.()
  init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
}))

vi.stubGlobal('createError', createError)
vi.stubGlobal('useRuntimeConfig', () => ({ gscdump: { apiKey: 'gsd_test', apiUrl: 'https://gscdump.test/api' } }))
vi.stubGlobal('fetch', hungFetch)

async function expectDeadline(call: () => Promise<unknown>) {
  const started = new Promise<void>((resolve) => {
    notifyFetchStarted = resolve
  })
  const rejected = expect(call()).rejects.toMatchObject({ statusCode: 504, data: { code: 'aborted' } })
  await started
  await vi.advanceTimersByTimeAsync(20)
  await rejected
}

describe('useGscdumpClient', () => {
  beforeEach(() => {
    hungFetch.mockClear()
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('Deadline expired', 'TimeoutError')), ms)
      return controller.signal
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    notifyFetchStarted = undefined
  })

  it('fails a hung call with 504 at its deadline, without a retry', async () => {
    await expectDeadline(() => useGscdumpClient({ timeoutMs: 20 }).getUserLifecycle('u_1'))
    expect(hungFetch).toHaveBeenCalledOnce()
  })

  it('gives each call its own deadline', async () => {
    const client = useGscdumpClient({ timeoutMs: 20 })
    await expectDeadline(() => client.getUserLifecycle('u_1'))
    await expectDeadline(() => client.getUserLifecycle('u_1'))
    expect(hungFetch).toHaveBeenCalledTimes(2)
  })
})
