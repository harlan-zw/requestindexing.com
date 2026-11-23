import type { ReportPolicy } from '@harlan-zw/nuxt-sentry/server'
import { decideReport } from '@harlan-zw/nuxt-sentry/server'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportPolicy } from '~~/shared/sentry'
import { RENDER_PATH_TIMEOUT_MS, useGscdumpClient } from './gscdump-client'
import { assertRegisteredGscSiteScope } from './registered-site-scope'

// The server Report Policy this site builds. `dropTransient` keeps the module
// default, which `nuxt.config.ts` does not override.
const serverPolicy: ReportPolicy = {
  scope: 'server',
  dataCollection: 'scrubbed',
  dropStatus: reportPolicy.dropServerStatus.map(status => ({ from: status, to: status })),
  dropTransient: true,
  ignoreErrors: reportPolicy.ignoreErrors.map(value => ({ _tag: 'literal', value })),
  dropStacklessErrors: [],
  dropBreadcrumbMessages: [],
  denyUrls: [],
  secretKeys: [],
}

// A deadline covers the request. Start the hung transport before advancing time,
// so cold SDK initialization cannot consume a real 20 ms test deadline.
let notifyFetchStarted: (() => void) | undefined
const hungFetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
  notifyFetchStarted?.()
  init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
}))

const linkedSites = [{ localSiteId: 'local', domain: 'example.com', property: 'sc-domain:example.com', principalIds: ['u_owner'], upstreamTeamId: 't_owner' }]
const identityResponse = {
  data: {
    identity: { siteId: 's_engine', userId: 'u_owner', teamId: 't_owner', requestedUrl: 'https://example.com', catalogSiteId: 1, warehouse: 'fixture', namespace: 'fixture', version: 1, revision: 1, catalogRevision: 1, dataVersion: 1 },
    coverage: { _tag: 'legacy' },
  },
  meta: { requestId: 'req_identity_fixture', surface: 'partner', version: '1.0' },
}

function delayedIdentity() {
  hungFetch.mockImplementationOnce((_url, init) => new Promise((resolve, reject) => {
    notifyFetchStarted?.()
    const timer = setTimeout(() => resolve(new Response(JSON.stringify(identityResponse), { headers: { 'content-type': 'application/json' } })), 3000)
    init.signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(init.signal?.reason)
    }, { once: true })
  }))
}

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

  it('leaves a call it aborted at its own deadline to the transient report rule', async () => {
    const started = new Promise<void>((resolve) => {
      notifyFetchStarted = resolve
    })
    const failure = useGscdumpClient({ timeoutMs: 20 }).getIndexingUrls('s_engine', { limit: 500, offset: 1000 }).catch((error: unknown) => error)
    await started
    await vi.advanceTimersByTimeAsync(20)
    const error = await failure

    expect(error).toMatchObject({ statusCode: 504, data: { code: 'aborted' } })
    expect(decideReport({ message: (error as Error).message }, error, serverPolicy)).toEqual({ _tag: 'drop', rule: 'transient' })
  })

  it('admits a fresh identity that takes longer than the optional-render budget', async () => {
    delayedIdentity()
    const started = new Promise<void>((resolve) => {
      notifyFetchStarted = resolve
    })
    const client = useGscdumpClient({ timeoutMs: 5000 })
    const readData = vi.fn(async () => 'authorized data')
    const read = assertRegisteredGscSiteScope('s_engine', linkedSites, id => client.getRegisteredHostIdentity(id)).then(readData)
    // Observe both outcomes immediately so a reverted deadline produces an
    // assertion failure rather than an unhandled rejection during timer ticks.
    const result = read.then(value => ({ value }), (error: unknown) => ({ error }))
    await started
    await vi.advanceTimersByTimeAsync(3000)
    expect(await result).toEqual({ value: 'authorized data' })
    expect(readData).toHaveBeenCalledOnce()
    expect(hungFetch).toHaveBeenCalledOnce()
  })

  it('fails closed before reading data when the configured identity budget expires', async () => {
    delayedIdentity()
    const started = new Promise<void>((resolve) => {
      notifyFetchStarted = resolve
    })
    const client = useGscdumpClient({ timeoutMs: 1000 })
    const readData = vi.fn()
    const read = assertRegisteredGscSiteScope('s_engine', linkedSites, id => client.getRegisteredHostIdentity(id)).then(readData)
    const result = expect(read).rejects.toMatchObject({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' })
    await started
    await vi.advanceTimersByTimeAsync(1000)
    await result
    expect(readData).not.toHaveBeenCalled()
    expect(hungFetch).toHaveBeenCalledOnce()
  })

  it('keeps an optional lifecycle read on its caller-specified render budget', async () => {
    const started = new Promise<void>((resolve) => {
      notifyFetchStarted = resolve
    })
    const read = useGscdumpClient({ timeoutMs: RENDER_PATH_TIMEOUT_MS }).getUserLifecycle('u_1')
    const result = expect(read).rejects.toMatchObject({ statusCode: 504, data: { code: 'aborted' } })
    await started
    await vi.advanceTimersByTimeAsync(RENDER_PATH_TIMEOUT_MS)
    await result
    expect(hungFetch).toHaveBeenCalledOnce()
  })
})
