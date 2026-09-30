import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { indexingUrlsQueryKey } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpIndexing'
import { firstPageIndexingUrlsParams } from '#layers/pro-indexing/app/utils/indexing-urls-first-page'

const payload = { data: {} as Record<string, unknown> }
let upstream: () => Promise<Response>

// The composable reaches these as Nuxt auto-imports. `event.fetch` stands in
// for Nitro's in-process fetch, which drops the abort signal it is given.
Object.assign(globalThis as Record<string, unknown>, {
  useNuxtApp: () => ({ payload }),
  useRequestEvent: () => ({ fetch: () => upstream() }),
})

const { useIndexingUrlsFirstPageSeed } = await import('./useIndexingUrlsFirstPageSeed')

beforeEach(() => {
  payload.data = {}
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('renders without the first page when the read does not answer in 8 seconds', async () => {
  vi.useFakeTimers()
  upstream = () => new Promise(() => {})
  let settled = false
  void useIndexingUrlsFirstPageSeed()('s_abc', 25).then(() => {
    settled = true
  })

  await vi.advanceTimersByTimeAsync(8_000)
  expect(settled).toBe(true)
  expect(payload.data).toEqual({})
})

it('seeds the first page under the key the table reads', async () => {
  const body = {
    urls: [],
    pagination: { total: 0, limit: 25, offset: 0, hasMore: false },
    meta: { siteUrl: 'sc-domain:example.com', status: 'ok', issue: null },
  }
  upstream = async () => Response.json({ data: body, meta: { requestId: 'req_01', surface: 'partner', version: '1.0' } })

  await useIndexingUrlsFirstPageSeed()('s_abc', 25)
  expect(payload.data[indexingUrlsQueryKey('s_abc', firstPageIndexingUrlsParams(25))]).toEqual(body)
})
