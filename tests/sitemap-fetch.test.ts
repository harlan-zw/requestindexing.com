import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSitemapUrlsFromXml, validatePublicSitemapUrl } from '../layers/core/server/app/services/sitemap-fetch'

describe('validatePublicSitemapUrl', () => {
  it.each([
    'https://example.com/sitemap.xml',
    'http://docs.example.org/sitemap_index.xml',
    'https://example.com:443/sitemap.xml',
    'http://example.com:80/sitemap.xml',
  ])('accepts public sitemap URL %s', (url) => {
    const result = validatePublicSitemapUrl(url)
    expect(result._tag).toBe('Ok')
  })

  it.each([
    ['file:///etc/passwd', 'non-HTTP scheme'],
    ['ftp://example.com/sitemap.xml', 'FTP scheme'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['https://user:pass@example.com/sitemap.xml', 'credentials'],
    ['https://example.com:8443/sitemap.xml', 'non-standard port'],
    ['http://localhost/sitemap.xml', 'localhost'],
    ['http://sub.localhost/sitemap.xml', 'subdomain of localhost'],
    ['http://printer.local/sitemap.xml', '.local host'],
    ['http://metadata.google.internal/computeMetadata/v1/', 'GCP metadata host'],
    ['http://intranet/sitemap.xml', 'single-label internal host'],
    ['http://127.0.0.1/sitemap.xml', 'IPv4 loopback'],
    ['http://2130706433/sitemap.xml', 'decimal IPv4 loopback'],
    ['http://0x7f000001/sitemap.xml', 'hex IPv4 loopback'],
    ['http://10.0.0.1/sitemap.xml', 'RFC 1918 10/8'],
    ['http://172.16.5.1/sitemap.xml', 'RFC 1918 172.16/12'],
    ['http://192.168.1.1/sitemap.xml', 'RFC 1918 192.168/16'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata IP'],
    ['http://100.64.0.1/sitemap.xml', 'CGNAT IP'],
    ['http://0.0.0.0/sitemap.xml', 'unspecified IP'],
    ['http://[::1]/sitemap.xml', 'IPv6 loopback'],
    ['http://[::ffff:127.0.0.1]/sitemap.xml', 'IPv4-mapped IPv6 loopback'],
    ['http://[fe80::1]/sitemap.xml', 'IPv6 link-local'],
    ['http://[fd00::1]/sitemap.xml', 'IPv6 ULA'],
  ])('rejects %s (%s)', (url) => {
    const result = validatePublicSitemapUrl(url)
    expect(result._tag).toBe('Err')
  })
})

describe('fetchSitemapUrlsFromXml', () => {
  it('parses URLs from a standard urlset', async () => {
    const mockFetch = vi.fn(async () => new Response(
      '<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>',
      { status: 200 },
    ))

    const urls = await fetchSitemapUrlsFromXml('https://example.com/sitemap.xml', { fetch: mockFetch })
    expect(urls).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('follows valid public redirects and rejects redirects to private hosts', async () => {
    const publicRedirectFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === 'https://example.com/sitemap.xml')
        return new Response(null, { status: 301, headers: { location: 'https://www.example.com/sitemap.xml' } })
      return new Response('<urlset><url><loc>https://www.example.com/page</loc></url></urlset>', { status: 200 })
    })

    const urls = await fetchSitemapUrlsFromXml('https://example.com/sitemap.xml', { fetch: publicRedirectFetch })
    expect(urls).toEqual(['https://www.example.com/page'])

    const ssrfRedirectFetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))

    await expect(
      fetchSitemapUrlsFromXml('https://example.com/sitemap.xml', { fetch: ssrfRedirectFetch }),
    ).rejects.toThrow(/not publicly routable/)
    expect(ssrfRedirectFetch).toHaveBeenCalledOnce()
  })

  it('rejects responses larger than maxBytes', async () => {
    const oversizedFetch = vi.fn(async () => new Response('x'.repeat(200), { status: 200 }))
    await expect(
      fetchSitemapUrlsFromXml('https://example.com/sitemap.xml', { fetch: oversizedFetch, maxBytes: 100 }),
    ).rejects.toThrow(/maximum allowed size/)
  })

  it('skips blocked private child URLs inside a sitemapindex while keeping valid public children', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target === 'https://example.com/sitemap-index.xml') {
        return new Response(
          `<sitemapindex>
            <sitemap><loc>http://169.254.169.254/latest/meta-data/</loc></sitemap>
            <sitemap><loc>https://example.com/posts.xml</loc></sitemap>
          </sitemapindex>`,
          { status: 200 },
        )
      }
      if (target === 'https://example.com/posts.xml')
        return new Response('<urlset><url><loc>https://example.com/post-1</loc></url></urlset>', { status: 200 })
      throw new Error(`Unexpected fetch to ${target}`)
    })

    const urls = await fetchSitemapUrlsFromXml('https://example.com/sitemap-index.xml', { fetch: mockFetch })
    expect(urls).toEqual(['https://example.com/post-1'])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('bulk-check handler sitemap hardening', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('rejects private sitemap URLs before rate limiting or fetching', async () => {
    const checkFreeToolRateLimit = vi.fn(async () => {})
    const fetchSitemap = vi.fn(async () => ['https://example.com/a'])

    vi.doMock('#layers/pro-saas/server/utils/rate-limit', () => ({ checkFreeToolRateLimit }))
    vi.doMock('~~/layers/core/server/app/services/sitemap-fetch', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../layers/core/server/app/services/sitemap-fetch')>()
      return { ...actual, fetchSitemapUrlsFromXml: fetchSitemap }
    })
    vi.doMock('~~/apps/marketing/server/utils/define-tool-handler', () => ({
      classifyToolFailure: () => 'validation',
      createBudgetExhaustedError: (message: string) => Object.assign(new Error(message), { statusCode: 503 }),
      recordFreeToolWideEvent: vi.fn(),
    }))

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async () => ({ sitemapUrl: 'http://169.254.169.254/latest/meta-data/' }))
    vi.stubGlobal('createError', (input: { statusCode: number, message: string }) => Object.assign(new Error(input.message), input))

    const handler = (await import('../apps/marketing/server/api/tools/bulk-check.post')).default
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(checkFreeToolRateLimit).not.toHaveBeenCalled()
    expect(fetchSitemap).not.toHaveBeenCalled()
  })

  it('enforces rate limit before fetching sitemap and does not double-count daily quota', async () => {
    const callOrder: string[] = []
    const checkFreeToolRateLimit = vi.fn(async (_event: unknown, opts?: { cost?: number, skipMinuteLimit?: boolean }) => {
      callOrder.push(`rateLimit:${opts?.cost ?? 1}:${Boolean(opts?.skipMinuteLimit)}`)
    })
    const fetchSitemap = vi.fn(async () => {
      callOrder.push('fetchSitemap')
      return ['https://example.com/a', 'https://example.com/b', 'https://example.com/c']
    })
    const checkUrlsIndexed = vi.fn(async (urls: string[]) => urls.map(url => ({ _tag: 'Checked', url, indexed: true, totalResults: 1 })))

    vi.doMock('#layers/pro-saas/server/utils/rate-limit', () => ({ checkFreeToolRateLimit }))
    vi.doMock('~~/layers/core/server/app/services/sitemap-fetch', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../layers/core/server/app/services/sitemap-fetch')>()
      return { ...actual, fetchSitemapUrlsFromXml: fetchSitemap }
    })
    vi.doMock('~~/layers/core/server/app/services/dataforseo', () => ({
      checkUrlsIndexed,
      dataForSeoCallContext: () => ({ tool: 'bulk-check' }),
    }))
    vi.doMock('~~/layers/core/server/app/services/dataforseo-spend', () => ({
      checkDataForSeoBudget: async () => ({ blocked: false }),
    }))
    vi.doMock('~~/apps/marketing/server/utils/define-tool-handler', () => ({
      classifyToolFailure: () => 'provider',
      createBudgetExhaustedError: (message: string) => Object.assign(new Error(message), { statusCode: 503 }),
      recordFreeToolWideEvent: vi.fn(),
    }))

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async () => ({ sitemapUrl: 'https://example.com/sitemap.xml' }))
    vi.stubGlobal('createError', (input: { statusCode: number, message: string }) => Object.assign(new Error(input.message), input))
    vi.stubGlobal('useStorage', () => ({
      getItem: async () => null,
      setItem: async () => {},
    }))

    const handler = (await import('../apps/marketing/server/api/tools/bulk-check.post')).default
    const result = await handler({} as never)

    expect(result.summary.total).toBe(3)
    // First rate-limit call runs BEFORE fetchSitemap (cost 1, minute limit active),
    // then tops up remaining 2 uncached URLs without consuming a second per-minute token.
    expect(callOrder).toEqual(['rateLimit:1:false', 'fetchSitemap', 'rateLimit:2:true'])
  })
})
