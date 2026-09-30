import { describe, expect, it } from 'vitest'
import { isPublicProbeTarget, parseRobotsSitemaps, parseSitemapIndexChildren, probeSitemap } from './sitemap-liveness'

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(status === 204 || status >= 300 ? null : body, { status, headers })
}

/** A fetch stub that answers from a map and records what it was asked for. */
function stubFetch(routes: Record<string, Response | (() => Promise<Response>)>) {
  const calls: string[] = []
  const fetch = async (input: string) => {
    calls.push(input)
    const route = routes[input]
    if (!route)
      return response(404)
    return typeof route === 'function' ? route() : route
  }
  return { fetch, calls }
}

function clock() {
  let value = 1_000
  return () => (value += 10)
}

describe('probeSitemap', () => {
  it('reports reachable when /sitemap.xml answers 200', async () => {
    const { fetch, calls } = stubFetch({
      'https://example.com/sitemap.xml': response(200, '<urlset><url><loc>https://example.com/</loc></url></urlset>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result.status).toBe('reachable')
    expect(result.statusCode).toBe(200)
    expect(calls).toEqual(['https://example.com/sitemap.xml'])
  })

  it('reports error with the status code when the sitemap 500s', async () => {
    const { fetch } = stubFetch({ 'https://example.com/sitemap.xml': response(500) })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'error', statusCode: 500 })
  })

  it('reports timeout when the request aborts', async () => {
    const { fetch } = stubFetch({
      'https://example.com/sitemap.xml': async () => {
        throw Object.assign(new Error('aborted'), { name: 'TimeoutError' })
      },
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'timeout', statusCode: null })
  })

  it('falls back to a robots.txt declaration when /sitemap.xml is a clean 404', async () => {
    const { fetch } = stubFetch({
      'https://example.com/robots.txt': response(200, 'User-agent: *\nSitemap: https://example.com/sitemap-main.xml\n'),
      'https://example.com/sitemap-main.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'reachable', statusCode: 200 })
  })

  it('reports the sitemap URL it found through robots.txt', async () => {
    const { fetch } = stubFetch({
      'https://example.com/robots.txt': response(200, 'Sitemap: https://example.com/sitemap-main.xml\n'),
      'https://example.com/sitemap-main.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result.url).toBe('https://example.com/sitemap-main.xml')
  })

  it('reports the redirect target as the sitemap URL', async () => {
    const { fetch } = stubFetch({
      'https://example.com/sitemap.xml': response(301, '', { location: 'https://www.example.com/sitemap.xml' }),
      'https://www.example.com/sitemap.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result.url).toBe('https://www.example.com/sitemap.xml')
  })

  it('probes the submitted sitemap without falling back to convention', async () => {
    const { fetch, calls } = stubFetch({
      'https://example.com/sitemap.xml': response(200, '<urlset/>'),
      'https://example.com/custom.xml': response(404),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() }, 'https://example.com/custom.xml')

    expect(result).toMatchObject({ status: 'error', statusCode: 404 })
    expect(calls).toEqual(['https://example.com/custom.xml'])
  })

  it('ignores an off-origin submitted sitemap and probes the convention instead', async () => {
    const { fetch, calls } = stubFetch({
      'https://example.com/sitemap.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() }, 'https://evil.test/sitemap.xml')

    expect(result.status).toBe('reachable')
    expect(calls).toEqual(['https://example.com/sitemap.xml'])
  })

  it('follows a redirect to the real sitemap', async () => {
    const { fetch } = stubFetch({
      'https://example.com/sitemap.xml': response(301, '', { location: '/sitemap-index.xml' }),
      'https://example.com/sitemap-index.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'reachable', statusCode: 200 })
  })

  it('reports the failure when a sitemap index has a dead child', async () => {
    const { fetch } = stubFetch({
      'https://example.com/sitemap.xml': response(200, '<sitemapindex><sitemap><loc>https://example.com/posts.xml</loc></sitemap></sitemapindex>'),
      'https://example.com/posts.xml': response(503),
    })

    const result = await probeSitemap('https://example.com', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'error', statusCode: 503 })
    expect(result.warnings?.[0]).toContain('https://example.com/posts.xml')
  })

  it('probes a Search Console domain property over https', async () => {
    const { fetch, calls } = stubFetch({
      'https://example.com/sitemap.xml': response(200, '<urlset/>'),
    })

    const result = await probeSitemap('sc-domain:example.com', { fetch, now: clock() })

    expect(result.status).toBe('reachable')
    expect(calls).toEqual(['https://example.com/sitemap.xml'])
  })

  it('reports error without a request when the site URL is not probeable', async () => {
    const { fetch, calls } = stubFetch({})

    const result = await probeSitemap('not a url', { fetch, now: clock() })

    expect(result).toMatchObject({ status: 'error', statusCode: null, durationMs: 0 })
    expect(calls).toEqual([])
  })
})

describe('isPublicProbeTarget', () => {
  it.each([
    ['https://example.com/sitemap.xml', true],
    ['http://example.com/sitemap.xml', true],
    ['https://localhost/sitemap.xml', false],
    ['https://127.0.0.1/sitemap.xml', false],
    ['https://10.1.2.3/sitemap.xml', false],
    ['https://192.168.0.5/sitemap.xml', false],
    ['https://172.20.1.1/sitemap.xml', false],
    ['https://169.254.169.254/latest', false],
    ['https://box.internal/sitemap.xml', false],
    ['file:///etc/passwd', false],
  ])('%s -> %s', (target, expected) => {
    expect(isPublicProbeTarget(target)).toBe(expected)
  })
})

describe('parseRobotsSitemaps', () => {
  it('reads every Sitemap directive, whatever its casing', () => {
    expect(parseRobotsSitemaps('User-agent: *\nsitemap: https://a.test/one.xml\nSITEMAP : https://a.test/two.xml\n'))
      .toEqual(['https://a.test/one.xml', 'https://a.test/two.xml'])
  })

  it('returns nothing for a robots file with no directives', () => {
    expect(parseRobotsSitemaps('User-agent: *\nDisallow: /admin\n')).toEqual([])
  })
})

describe('parseSitemapIndexChildren', () => {
  it('returns null for a plain urlset', () => {
    expect(parseSitemapIndexChildren('<urlset><url><loc>https://a.test/</loc></url></urlset>')).toBeNull()
  })

  it('returns each child location of an index', () => {
    expect(parseSitemapIndexChildren(
      '<sitemapindex><sitemap><loc>https://a.test/one.xml</loc></sitemap><sitemap><loc>https://a.test/two.xml</loc></sitemap></sitemapindex>',
    )).toEqual(['https://a.test/one.xml', 'https://a.test/two.xml'])
  })
})
