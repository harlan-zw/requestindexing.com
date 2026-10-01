import { describe, expect, it } from 'vitest'
import { checkUrlIndexed, getDomainOverview } from '../layers/core/server/app/services/dataforseo'
import { DATAFORSEO_UNAVAILABLE_MESSAGE } from '../shared/dataforseo'

type ProviderFetch = (url: string) => Promise<unknown>

function callContext(providerFetch: ProviderFetch) {
  return {
    budgetMicros: 0,
    credentials: { login: 'login', password: 'password' },
    providerFetch: providerFetch as unknown as typeof $fetch,
    storage: { getItem: async () => null, setItem: () => Promise.resolve() },
  }
}

/** DataForSEO answers HTTP 200 and puts the outcome on the task. */
function answering(task: Record<string, unknown>): ProviderFetch {
  return async () => ({ status_code: 20000, status_message: 'Ok.', tasks: [task] })
}

// Every one of these is an HTTP 200 with no search behind it.
const tasksWithoutSearch: Array<[string, Record<string, unknown>]> = [
  ['an internal error', { status_code: 50000, status_message: 'Internal Error.', result: null }],
  ['a rate limit', { status_code: 40202, status_message: 'The rate-limit per minute has been exceeded.', result: null }],
  ['insufficient funds', { status_code: 40210, status_message: 'Insufficient Funds.', result: null }],
  ['an invalid field', { status_code: 40501, status_message: 'Invalid Field.', result: null }],
  ['a success code and no result', { status_code: 20000, status_message: 'Ok.', result: null }],
]

describe('checkUrlIndexed', () => {
  it.each(tasksWithoutSearch)('answers a task with %s as unavailable, never as not indexed', async (_, task) => {
    const outcome = checkUrlIndexed('https://example.com/page', callContext(answering(task)))

    await expect(outcome).rejects.toMatchObject({ statusCode: 503, message: DATAFORSEO_UNAVAILABLE_MESSAGE })
  })

  it('keeps the task status on the 503, so an account failure stays visible', async () => {
    const outcome = checkUrlIndexed(
      'https://example.com/page',
      callContext(answering({ status_code: 40210, status_message: 'Insufficient Funds.', result: null })),
    )

    await expect(outcome).rejects.toMatchObject({
      cause: { message: expect.stringContaining('40210 Insufficient Funds.') },
    })
  })

  it('reports not indexed when Google ran the search and returned no results', async () => {
    const result = await checkUrlIndexed(
      'https://example.com/page',
      callContext(answering({ status_code: 40102, status_message: 'No Search Results.', result: null })),
    )

    expect(result).toEqual({ url: 'https://example.com/page', indexed: false, totalSiteResults: 0 })
  })
})

describe('getDomainOverview', () => {
  it.each(tasksWithoutSearch)('answers a site: search task with %s as unavailable, never as zero indexed pages', async (_, task) => {
    const labs = answering({ status_code: 20000, status_message: 'Ok.', result: [{ items: [] }] })
    const providerFetch: ProviderFetch = url => url.includes('/serp/') ? answering(task)(url) : labs(url)

    const outcome = getDomainOverview('example.com', callContext(providerFetch))

    await expect(outcome).rejects.toMatchObject({ statusCode: 503, message: DATAFORSEO_UNAVAILABLE_MESSAGE })
  })
})
