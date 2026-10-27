/**
 * Route prefixes the worker renders on every request. Nothing under them is
 * written to disk at build time.
 *
 * `ogImage.zeroRuntime` strips the OG image renderer out of the worker bundle,
 * so an OG image can only be served as a file produced during prerendering.
 * A runtime-only route must therefore never emit an OG image URL: no file
 * exists behind that URL and the stripped renderer throws instead of rendering.
 *
 * This list is the single source for both facts. `nuxt.config.ts` turns it into
 * `prerender: false` route rules, and `layers/core/app/app.vue` uses it to skip
 * the site-wide OG image. Add a prefix here and the two stay in step.
 */
export const RUNTIME_ONLY_ROUTE_PREFIXES = [
  '/_alt',
  '/account',
  '/admin',
  '/api',
  '/auth',
  '/dashboard',
  '/kit',
  '/login',
  '/pro',
  '/team-invitations',
  '/ws',
] as const

export function isRuntimeOnlyRoute(path: string): boolean {
  const pathname = path.split('?')[0]!.split('#')[0]!
  return RUNTIME_ONLY_ROUTE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** `prerender: false` rules for every runtime-only prefix, keyed by glob. */
export function runtimeOnlyRouteRules(): Record<string, { prerender: false }> {
  return Object.fromEntries(
    RUNTIME_ONLY_ROUTE_PREFIXES.map(prefix => [`${prefix}/**`, { prerender: false }]),
  )
}

/**
 * Every page the build writes to disk. Cloudflare serves these files before the
 * worker runs, so the worker cannot answer `Accept: text/markdown` on them.
 *
 * A zone URL Rewrite Rule serves each page's `.md` file instead. It matches
 * these exact paths, as `docs/arch/README.md` describes. A page missing from
 * that rule answers Markdown requests with HTML.
 */
export const PRERENDERED_PAGE_PATHS = [
  '/',
  '/bulk-submit-urls-google-indexing-api',
  '/comparisons',
  '/comparisons/vs-indexly',
  '/comparisons/vs-seo-gets',
  '/comparisons/vs-tagparrot',
  '/google-indexing-api',
  '/google-indexing-api-node-js',
  '/google-indexing-api-quota',
  '/google-indexing-api-tutorial',
  '/guides',
  '/indexing-api-for-blog-posts',
  '/privacy',
  '/terms',
  '/tools',
  '/tools/bulk-indexing-checker',
  '/tools/google-indexing-checker',
  '/tools/site-indexing-report',
] as const

/**
 * `Vary: Accept` rules for every prerendered page. The zone rewrite answers
 * HTML and Markdown on one URL, so a cache must key on the Accept header.
 */
export function markdownVaryRouteRules(paths: readonly string[] = PRERENDERED_PAGE_PATHS): Record<string, { headers: { vary: 'Accept' } }> {
  return Object.fromEntries(paths.map(path => [path, { headers: { vary: 'Accept' } }]))
}

/**
 * Moved paths, old path to new path. Each one answers with a real 301.
 *
 * A prerendered redirect is written to disk as a `<meta http-equiv="refresh">`
 * page, and Cloudflare serves that file with HTTP 200 before the worker runs.
 * Crawlers then read the old path as a live page with no title, no viewport,
 * and no content. So every redirect here stays out of the prerender, even
 * when the crawler finds a link to it.
 */
export const PERMANENT_REDIRECTS = {
  // The legacy sign-up door. `/pro/onboarding` is the one entry now, so the
  // old path keeps its inbound links and search results alive.
  '/get-started': '/pro/onboarding',
  // The Site picker moved under the Sites roster, matching nuxtseo.com.
  '/pro/dashboard/team/sites': '/pro/dashboard/sites/connect',
  // The all-sites indexing page moved to nuxtseo.com's route.
  '/pro/dashboard/web-indexing': '/pro/dashboard/indexing',
} as const satisfies Record<string, string>

interface RedirectRouteRule {
  redirect: { to: string, statusCode: 301 }
  prerender: false
}

/** 301 route rules for every moved path, each kept out of the prerender. */
export function redirectRouteRules(redirects: Record<string, string> = PERMANENT_REDIRECTS): Record<string, RedirectRouteRule> {
  return Object.fromEntries(
    Object.entries(redirects).map(([from, to]) => [from, { redirect: { to, statusCode: 301 }, prerender: false }]),
  )
}
