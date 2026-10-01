import { describe, expect, it, vi } from 'vitest'
import { checkUrlIndexed, checkUrlsIndexed, getDomainOverview, tagDataForSeoTasks } from '../layers/core/server/app/services/dataforseo'
import { DATAFORSEO_RETRY_OPTIONS, DATAFORSEO_UNAVAILABLE_MESSAGE } from '../shared/dataforseo'

function callContext() {
  return {
    budgetMicros: 0,
    credentials: { login: 'login', password: 'password' },
    storage: {
      getItem: async () => null,
      setItem: () => Promise.resolve(),
    },
  }
}

describe('dataForSEO requests', () => {
  it('attributes every provider task to its app and target Site', () => {
    const tagged = tagDataForSeoTasks([
      { keyword: 'site:https://docs.example.com/guide' },
      { target: 'shop.example.net' },
    ], 'bulk-check', 'request-123')

    expect(tagged.map(task => task.tag)).toEqual([
      'v=1&app=request-indexing.com&site=docs.example.com&source=bulk-check&request=request-123&task=0',
      'v=1&app=request-indexing.com&site=shop.example.net&source=bulk-check&request=request-123&task=1',
    ])
  })

  it('adds attribution at the provider transport boundary', async () => {
    const fetchMock = vi.fn(async (_url: string, _options: { body: Array<{ tag: string }> }) => ({
      tasks: [{ status_code: 20000, status_message: 'Ok.', result: [{ se_results_count: 0, items: [] }] }],
    }))
    await checkUrlIndexed('https://docs.example.com/guide', {
      budgetMicros: 0,
      credentials: { login: 'login', password: 'password' },
      providerFetch: fetchMock as unknown as typeof $fetch,
      storage: {
        getItem: async () => null,
        setItem: () => Promise.resolve(),
      },
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const options = fetchMock.mock.calls[0]![1]
    expect(options.body[0]?.tag).toMatch(
      /^v=1&app=request-indexing\.com&site=docs\.example\.com&source=internal&request=[^&]+&task=0$/,
    )
  })

  it('retries transient Cloudflare and upstream failures', () => {
    expect(DATAFORSEO_RETRY_OPTIONS).toEqual(expect.objectContaining({
      retry: 2,
      retryStatusCodes: expect.arrayContaining([429, 500, 520, 524]),
    }))
  })

  it('answers a transient provider outage with a 503', async () => {
    const outcome = checkUrlIndexed('https://docs.example.com/guide', {
      ...callContext(),
      providerFetch: (() => Promise.reject(
        Object.assign(new Error('upstream unavailable'), { statusCode: 520 }),
      )) as unknown as typeof $fetch,
    })

    await expect(outcome).rejects.toMatchObject({
      statusCode: 503,
      message: DATAFORSEO_UNAVAILABLE_MESSAGE,
    })
  })

  it('keeps a credential failure at its own status', async () => {
    const outcome = checkUrlsIndexed(['https://docs.example.com/guide'], {
      ...callContext(),
      providerFetch: (() => Promise.reject(
        Object.assign(new Error('unauthorized'), { statusCode: 401 }),
      )) as unknown as typeof $fetch,
    })

    await expect(outcome).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('getDomainOverview', () => {
  it('reads the indexed page estimate from the SERP result count', async () => {
    // DataForSEO names the count `se_results_count`. Reading a `total` field,
    // which the API never sends, made every Site Indexing Report show zero.
    const providerFetch = vi.fn(async (url: string) => url.includes('/serp/')
      ? { tasks: [{ status_code: 20000, status_message: 'Ok.', result: [{ se_results_count: 1234, items: [] }] }] }
      : { tasks: [{ result: [{ items: [] }] }] })

    const overview = await getDomainOverview('example.com', {
      ...callContext(),
      providerFetch: providerFetch as unknown as typeof $fetch,
    })

    expect(overview.estimatedIndexedPages).toBe(1234)
  })
})
