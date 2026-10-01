import { describe, expect, it } from 'vitest'
import { checkUrlsIndexed } from '../layers/core/server/app/services/dataforseo'
import { matchSiteSearch } from '../layers/core/server/app/services/site-search'

function organic(url: string, title = `Title of ${url}`) {
  return { type: 'organic', url, title, description: '', position: 1 }
}

describe('matchSiteSearch', () => {
  it('reports a URL as not indexed when site: only returns another URL under its path', () => {
    const result = matchSiteSearch('https://example.com/blog', {
      total: 1,
      items: [organic('https://example.com/blog/other')],
    })

    expect(result).toEqual({ url: 'https://example.com/blog', indexed: false, totalSiteResults: 1 })
  })

  it('reports a URL as indexed when a later result is the URL itself', () => {
    const result = matchSiteSearch('https://example.com/blog', {
      total: 2,
      items: [organic('https://example.com/blog/other'), organic('https://example.com/blog/', 'Blog')],
    })

    expect(result).toEqual({
      url: 'https://example.com/blog',
      indexed: true,
      matchedUrl: 'https://example.com/blog/',
      matchedTitle: 'Blog',
      totalSiteResults: 2,
    })
  })

  it.each([
    ['one trailing slash', 'https://example.com/blog', 'https://example.com/blog/'],
    ['the protocol', 'https://example.com/blog', 'http://example.com/blog'],
    ['a www. prefix', 'https://example.com/blog', 'https://www.example.com/blog'],
    ['host case', 'https://Example.COM/blog', 'https://example.com/blog'],
    ['the fragment', 'https://example.com/blog#comments', 'https://example.com/blog'],
    ['the same query string', 'https://example.com/blog?page=2', 'https://example.com/blog?page=2'],
    ['the root path', 'https://example.com', 'https://www.example.com/'],
  ])('matches a result that differs only by %s', (_, checked, returned) => {
    expect(matchSiteSearch(checked, { total: 1, items: [organic(returned)] }).indexed).toBe(true)
  })

  it.each([
    ['a child path', 'https://example.com/blog', 'https://example.com/blog/other'],
    ['a sibling with the same prefix', 'https://example.com/blog', 'https://example.com/blog-post'],
    ['a different query string', 'https://example.com/blog', 'https://example.com/blog?page=2'],
    ['path case', 'https://example.com/blog', 'https://example.com/Blog'],
    ['another subdomain', 'https://example.com/blog', 'https://docs.example.com/blog'],
  ])('does not match a result that differs by %s', (_, checked, returned) => {
    expect(matchSiteSearch(checked, { total: 1, items: [organic(returned)] }).indexed).toBe(false)
  })

  it('ignores a non-organic result for the same URL', () => {
    const result = matchSiteSearch('https://example.com/blog', {
      total: 1,
      items: [{ ...organic('https://example.com/blog'), type: 'video' }],
    })

    expect(result.indexed).toBe(false)
  })
})

describe('checkUrlsIndexed', () => {
  it('matches each URL in a batch against its own site: search', async () => {
    const providerFetch = async () => ({
      tasks: [
        { result: [{ total: 1, items: [organic('https://example.com/blog/other')] }] },
        { result: [{ total: 1, items: [organic('https://example.com/about/', 'About')] }] },
      ],
    })

    const results = await checkUrlsIndexed(['https://example.com/blog', 'https://example.com/about'], {
      budgetMicros: 0,
      credentials: { login: 'login', password: 'password' },
      providerFetch: providerFetch as unknown as typeof $fetch,
      storage: { getItem: async () => null, setItem: () => Promise.resolve() },
    })

    expect(results).toEqual([
      { url: 'https://example.com/blog', indexed: false, totalSiteResults: 1 },
      {
        url: 'https://example.com/about',
        indexed: true,
        matchedUrl: 'https://example.com/about/',
        matchedTitle: 'About',
        totalSiteResults: 1,
      },
    ])
  })
})
