import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGscdumpClient } from './gscdump-client'

// On 2026-10-01 a gscdump lifecycle read took 57 s, and the dashboard renders
// waiting on it took 60 s and 23 s. A call must give up at its deadline.
const hungFetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
}))

vi.stubGlobal('createError', createError)
vi.stubGlobal('useRuntimeConfig', () => ({ gscdump: { apiKey: 'gsd_test', apiUrl: 'https://gscdump.test/api' } }))
vi.stubGlobal('fetch', hungFetch)

describe('useGscdumpClient', () => {
  beforeEach(() => {
    hungFetch.mockClear()
  })

  it('fails a hung call with 504 at its deadline, without a retry', async () => {
    await expect(useGscdumpClient({ timeoutMs: 20 }).getUserLifecycle('u_1')).rejects.toMatchObject({
      statusCode: 504,
      data: { code: 'aborted' },
    })
    expect(hungFetch).toHaveBeenCalledOnce()
  })

  it('gives each call its own deadline', async () => {
    const client = useGscdumpClient({ timeoutMs: 20 })
    await expect(client.getUserLifecycle('u_1')).rejects.toMatchObject({ statusCode: 504 })

    // A spent deadline from the first call must not fail the second before it is sent.
    await expect(client.getUserLifecycle('u_1')).rejects.toMatchObject({ statusCode: 504 })
    expect(hungFetch).toHaveBeenCalledTimes(2)
  })
})
