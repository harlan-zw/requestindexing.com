import { defineHandler } from 'nuxt/server'
import { ANONYMOUS_404_MAX_AGE_SECONDS } from '~~/shared/server/static-probe-404'

/**
 * Catch unmatched `/api/**` requests before Nitro falls through to the Nuxt
 * HTML SSR renderer (`/**`). Specific `/api/...` routes always take precedence
 * over this catch-all.
 */
export default defineHandler((event) => {
  const method = event.req.method.toUpperCase()
  const isAnonymousRead = (method === 'GET' || method === 'HEAD')
    && !event.req.headers.get('cookie')
    && !event.req.headers.get('authorization')

  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  }

  if (isAnonymousRead)
    headers['cloudflare-cdn-cache-control'] = `public, max-age=${ANONYMOUS_404_MAX_AGE_SECONDS}`

  return new Response(
    method === 'HEAD' ? null : JSON.stringify({ statusCode: 404, statusMessage: 'Not Found' }),
    { status: 404, headers },
  )
})
