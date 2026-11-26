import { describe, expect, it } from 'vitest'
import apiNotFoundHandler from '../server/api/[...]'
import { PRERENDERED_PAGE_PATHS, RUNTIME_ONLY_ROUTE_PREFIXES } from '../shared/routes'
import {
  ANONYMOUS_404_MAX_AGE_SECONDS,
  applyAnonymous404CacheHeaders,
  createFast404Response,
  isStaticProbe404,
  STATIC_PROBE_404_MAX_AGE_SECONDS,
} from '../shared/server/static-probe-404'
import { mockRequestEvent } from './support/mock-request-event'

describe('isStaticProbe404', () => {
  it.each([
    // PHP & WordPress probes observed in production o11y
    '/wp-login.php',
    '/wp-filemannger.php',
    '/wp-blog.php',
    '/dffssa1.php',
    '/class-meta-cache.php',
    '/wp-ccd.php?p=',
    '/index.php.old',
    '/index.php.save',
    '/wp-content/debug.log',
    '/wp-admin/install.php',
    '/wp-includes/wlwmanifest.xml',
    '//cms/wp-includes/wlwmanifest.xml',
    '//blog/wp-includes/wlwmanifest.xml',
    '//wp-includes/ID3/license.txt',
    '/wordpress/wp-admin',
    '/xmlrpc.php',
    // Dotfiles & hidden directories
    '/.env',
    '/.env.production',
    '/.git/config',
    '/.vscode/settings.json',
    '/.well-known/traffic-advice',
    '/.well-known/security.txt',
    '/.classpath',
    '/.editorconfig',
    '/.prettierrc',
    '/.htaccess',
    '/.ds_store',
    // Config, database, script, backup, archive, and missing asset extensions
    '/config.yml',
    '/config.yaml',
    '/install.sql',
    '/inventory.ini',
    '/ansible.cfg',
    '/local_settings.py',
    '/backup.zip',
    '/dump.tar.gz',
    '/missing-image.png',
    '/apple-touch-icon-precomposed.png',
    '/bundle.js.map',
    '/nonexistent.json',
    // Framework debuggers & extensionless scanner paths
    '/_ignition/health-check',
    '/_debugbar',
    '/_profiler/empty',
    '/_status',
    '/_info',
    '/phpmyadmin',
    '/cgi-bin/test',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/Makefile',
    '/Dockerfile',
    '/brewfile',
    '/null',
    '/undefined',
    '/metrics',
    '//feed/',
    '/feed',
    '/rss',
    // Percent-encoded and uppercase probes
    '/%2eenv',
    '/WP-LOGIN.PHP',
    '/CONFIG.YML',
  ])('fast-paths scanner or static probe %s', (path) => {
    expect(isStaticProbe404(path)).toBe(true)
  })

  it.each([
    // Root & SEO / AI files
    '/',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-guides.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/llms/guides.md',
    '/index.md',
    '/google-indexing-api.md',
    '/skills/google-indexing/SKILL.md',
    '/.well-known/agent-skills/index.json',
    '/.well-known/agent-skills/google-indexing/SKILL.md',
    '/get-started',
    '/privacy',
    '/terms',
    // Nuxt / Nitro / module dynamic prefixes
    '/_og/s/splash.png',
    '/_og-static-fonts/dm-sans-400.woff2',
    '/__og-image__/image/og.png',
    '/_nuxt/entry.js',
    '/_nuxt/builds/meta/latest.json',
    '/_ipx/w_800/images/guides/example.png',
    '/__comark_content/guides/index.json',
    '/__nuxt_error?statusCode=404',
    '/__sitemap__/style.xsl',
    '/_favicon?domain=example.com',
    '/_ws',
    '/ws',
    '/_alt/preview.png',
    // API & auth endpoints
    '/api/pro/caller',
    '/api/_auth/session',
    '/api/_nuxt_icon/lucide.json',
    '/api/_gscdump/gsc/v1/sites',
    '/api/webhooks/gscdump',
    '/api/tools/check-index',
    '/auth/google',
    '/auth/google-indexing',
    '/auth/integrations/gsc/connect',
    '/auth/integrations/gsc/callback',
    '/auth/logout',
    // Dynamic app routes whose params legitimately contain dots or extensions
    '/pro/dashboard',
    '/pro/dashboard/sites/s_abc/search-console/pages/wp-login.php',
    '/pro/dashboard/sites/s_abc/search-console/pages/blog/post.html',
    '/pro/dashboard/sites/s_abc/search-console/queries/node.js',
    '/pro/onboarding',
    '/dashboard/site/harlanzw.com/overview',
    '/dashboard/site/example.co.uk/sitemaps',
    '/account',
    '/admin',
    '/admin/sites/s_abc',
    '/kit/buttons',
    '/login',
    '/team-invitations/tok_123',
    // Public content sections
    '/guides',
    '/tools',
    '/tools/google-indexing-checker',
    '/comparisons',
    '/comparisons/vs-indexly',
  ])('never blocks legitimate route %s', (path) => {
    expect(isStaticProbe404(path)).toBe(false)
  })

  it('allows every prerendered page and runtime-only prefix', () => {
    for (const path of PRERENDERED_PAGE_PATHS)
      expect(isStaticProbe404(path), `prerendered ${path}`).toBe(false)

    for (const prefix of RUNTIME_ONLY_ROUTE_PREFIXES) {
      expect(isStaticProbe404(prefix), `runtime prefix ${prefix}`).toBe(false)
      expect(isStaticProbe404(`${prefix}/nested/item.php`), `runtime child ${prefix}`).toBe(false)
    }
  })

  it.each([
    '/some-missing-page',
    '/typo-guide',
    '/old-url',
  ])('leaves extensionless human-plausible path %s to branded error handling', (path) => {
    expect(isStaticProbe404(path)).toBe(false)
  })
})

describe('createFast404Response', () => {
  it('returns plain-text 404 with edge cache and noindex headers', async () => {
    const response = createFast404Response('GET')
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe(`public, max-age=${STATIC_PROBE_404_MAX_AGE_SECONDS}`)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(await response.text()).toBe('Not Found')
  })

  it('omits the response body for HEAD requests', async () => {
    const response = createFast404Response('HEAD')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })
})

describe('applyAnonymous404CacheHeaders', () => {
  it.each(['GET', 'HEAD'])('adds short edge cache and noindex on anonymous %s 404', (method) => {
    const response = new Response('not found', {
      status: 404,
      headers: {
        'cache-control': 'private, no-store',
        'x-robots-tag': 'index, follow',
      },
    })
    applyAnonymous404CacheHeaders(response, { method, headers: new Headers() })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe(`public, max-age=${ANONYMOUS_404_MAX_AGE_SECONDS}`)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('does not add edge caching when Cookie or Authorization is present', () => {
    for (const [header, value] of [['cookie', 'nuxt-session=abc'], ['authorization', 'Bearer tok']] as const) {
      const response = new Response('not found', { status: 404, headers: { 'cache-control': 'private, no-store' } })
      applyAnonymous404CacheHeaders(response, { method: 'GET', headers: new Headers({ [header]: value }) })
      expect(response.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    }
  })

  it('does not add edge caching when response emits Set-Cookie', () => {
    const response = new Response('not found', {
      status: 404,
      headers: { 'set-cookie': 'pro-first-touch=1; Path=/' },
    })
    applyAnonymous404CacheHeaders(response, { method: 'GET', headers: new Headers() })
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBeNull()
  })

  it('does not cache non-GET/HEAD or non-404 responses', () => {
    const post404 = new Response('not found', { status: 404 })
    applyAnonymous404CacheHeaders(post404, { method: 'POST', headers: new Headers() })
    expect(post404.headers.get('cloudflare-cdn-cache-control')).toBeNull()

    const ok200 = new Response('ok', { status: 200 })
    applyAnonymous404CacheHeaders(ok200, { method: 'GET', headers: new Headers() })
    expect(ok200.headers.get('cloudflare-cdn-cache-control')).toBeNull()
  })

  it('preserves an existing cloudflare-cdn-cache-control header', () => {
    const response = createFast404Response('GET')
    applyAnonymous404CacheHeaders(response, { method: 'GET', headers: new Headers() })
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe(`public, max-age=${STATIC_PROBE_404_MAX_AGE_SECONDS}`)
  })
})

describe('unmatched /api/** catch-all handler', () => {
  it('returns fast JSON 404 with edge cache on anonymous GET', async () => {
    const response = await apiNotFoundHandler(mockRequestEvent({ url: '/api/session/properties', method: 'GET' }))
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe(`public, max-age=${ANONYMOUS_404_MAX_AGE_SECONDS}`)
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(await response.json()).toEqual({ statusCode: 404, statusMessage: 'Not Found' })
  })

  it('omits edge cache on authenticated or POST requests', async () => {
    const authed = await apiNotFoundHandler(mockRequestEvent({
      url: '/api/session/properties',
      method: 'GET',
      headers: { cookie: 'nuxt-session=abc' },
    }))
    expect(authed.status).toBe(404)
    expect(authed.headers.get('cloudflare-cdn-cache-control')).toBeNull()

    const posted = await apiNotFoundHandler(mockRequestEvent({
      url: '/api/graphql',
      method: 'POST',
    }))
    expect(posted.status).toBe(404)
    expect(posted.headers.get('cloudflare-cdn-cache-control')).toBeNull()
  })
})
