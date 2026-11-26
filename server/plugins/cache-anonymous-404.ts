import { definePlugin } from 'nitro'
import { applyAnonymous404CacheHeaders } from '~~/shared/server/static-probe-404'

/**
 * Allow Cloudflare's edge cache to absorb repeated anonymous 404s for 60s
 * while keeping browsers uncached (`no-store`) and never caching requests that
 * carry credentials (`Cookie` / `Authorization`) or emit `Set-Cookie`.
 */
export default definePlugin((nitroApp) => {
  if (import.meta.dev || import.meta.prerender)
    return

  nitroApp.hooks.hook('response', (response, event) => {
    applyAnonymous404CacheHeaders(response, event.req)
  })
})
