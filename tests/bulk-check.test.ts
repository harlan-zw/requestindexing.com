import { describe, expect, it, vi } from 'vitest'
import { checkUrlsIndexed } from '../layers/core/server/app/services/dataforseo'
import { bulkCheckUrls } from '../shared/bulk-check'
import { DATAFORSEO_UNAVAILABLE_MESSAGE } from '../shared/dataforseo'

interface ProviderOptions { body: Array<{ keyword: string }> }

function organic(url: string) {
  return { type: 'organic', url, title: `Title of ${url}`, description: '', position: 1 }
}

function checkedUrl(options: ProviderOptions): string {
  return options.body[0]!.keyword.slice('site:'.length)
}

function callContext(providerFetch: (url: string, options: ProviderOptions) => Promise<unknown>) {
  return {
    budgetMicros: 0,
    credentials: { login: 'login', password: 'password' },
    providerFetch: providerFetch as unknown as typeof $fetch,
    storage: { getItem: async () => null, setItem: () => Promise.resolve() },
  }
}

function providerFailure(statusCode: number) {
  return Object.assign(new Error(`provider answered ${statusCode}`), { statusCode })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('checkUrlsIndexed', () => {
  it('sends one search per URL and matches each verdict to its own URL', async () => {
    // The first URL answers last, so a verdict matched by arrival order lands on the wrong row.
    const delays: Record<string, number> = {
      'https://example.com/a': 30,
      'https://example.com/b': 10,
      'https://example.com/c': 0,
    }
    const serps: Record<string, unknown> = {
      'https://example.com/a': { se_results_count: 1, items: [organic('https://example.com/a/')] },
      'https://example.com/b': { se_results_count: 1, items: [organic('https://example.com/b/other')] },
      'https://example.com/c': { se_results_count: 1, items: [organic('https://www.example.com/c')] },
    }
    const providerFetch = vi.fn(async (_url: string, options: ProviderOptions) => {
      const url = checkedUrl(options)
      await sleep(delays[url] ?? 0)
      return { tasks: options.body.map(() => ({ result: [serps[url]] })) }
    })

    const rows = await checkUrlsIndexed(Object.keys(serps), callContext(providerFetch))

    expect(providerFetch).toHaveBeenCalledTimes(3)
    expect(providerFetch.mock.calls.map(([, options]) => options.body)).toEqual([
      [expect.objectContaining({ keyword: 'site:https://example.com/a' })],
      [expect.objectContaining({ keyword: 'site:https://example.com/b' })],
      [expect.objectContaining({ keyword: 'site:https://example.com/c' })],
    ])
    expect(rows).toMatchObject([
      { _tag: 'Checked', url: 'https://example.com/a', indexed: true, matchedUrl: 'https://example.com/a/' },
      { _tag: 'Checked', url: 'https://example.com/b', indexed: false },
      { _tag: 'Checked', url: 'https://example.com/c', indexed: true, matchedUrl: 'https://www.example.com/c' },
    ])
  })

  it('never has more than three searches in flight at once', async () => {
    let inFlight = 0
    let mostInFlight = 0
    const providerFetch = vi.fn(async () => {
      inFlight++
      mostInFlight = Math.max(mostInFlight, inFlight)
      await sleep(5)
      inFlight--
      return { tasks: [{ result: [{ se_results_count: 0, items: [] }] }] }
    })
    const urls = Array.from({ length: 10 }, (_, index) => `https://example.com/${index}`)

    const rows = await checkUrlsIndexed(urls, callContext(providerFetch))

    expect(providerFetch).toHaveBeenCalledTimes(10)
    expect(rows.map(row => row.url)).toEqual(urls)
    expect(mostInFlight).toBeLessThanOrEqual(3)
  })

  it('marks a URL as not checked when the provider is down for that URL only', async () => {
    const providerFetch = async (_url: string, options: ProviderOptions) => {
      const url = checkedUrl(options)
      if (url === 'https://example.com/b')
        throw providerFailure(520)
      return { tasks: [{ result: [{ se_results_count: 1, items: [organic(url)] }] }] }
    }

    const rows = await checkUrlsIndexed(
      ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'],
      callContext(providerFetch),
    )

    expect(rows).toEqual([
      expect.objectContaining({ _tag: 'Checked', url: 'https://example.com/a', indexed: true }),
      { _tag: 'NotChecked', url: 'https://example.com/b' },
      expect.objectContaining({ _tag: 'Checked', url: 'https://example.com/c', indexed: true }),
    ])
  })

  it('answers with a 503 when the provider is down for every URL', async () => {
    const outcome = checkUrlsIndexed(
      ['https://example.com/a', 'https://example.com/b'],
      callContext(async () => {
        throw providerFailure(520)
      }),
    )

    await expect(outcome).rejects.toMatchObject({ statusCode: 503, message: DATAFORSEO_UNAVAILABLE_MESSAGE })
  })

  it('stops starting searches after a credential failure', async () => {
    const providerFetch = vi.fn(async () => {
      throw providerFailure(401)
    })
    const urls = Array.from({ length: 10 }, (_, index) => `https://example.com/${index}`)

    await expect(checkUrlsIndexed(urls, callContext(providerFetch))).rejects.toMatchObject({ statusCode: 401 })
    expect(providerFetch.mock.calls.length).toBeLessThanOrEqual(3)
  })
})

describe('bulkCheckUrls', () => {
  it('keeps only the first 10 URLs', () => {
    const urls = Array.from({ length: 12 }, (_, index) => `https://example.com/${index}`)

    expect(bulkCheckUrls(urls)).toEqual(urls.slice(0, 10))
  })

  it('trims each line, drops blank lines, adds https and counts a repeated URL once', () => {
    expect(bulkCheckUrls([' example.com/a ', '', 'https://example.com/a', 'http://example.com/b', '   ']))
      .toEqual(['https://example.com/a', 'http://example.com/b'])
  })
})
