import { defineHandler } from 'nuxt/server'
import { createFast404Response, isStaticProbe404 } from '~~/shared/server/static-probe-404'

/**
 * Short-circuit static asset, CMS, dotfile, and scanner 404 probes before Nuxt
 * SSR boots. Cloudflare Workers Static Assets already serves every real file
 * in `public/` and every prerendered page before this Worker runs, so matching
 * probes reaching the Worker are guaranteed 404s.
 */
export default defineHandler((event) => {
  if (import.meta.dev || import.meta.prerender)
    return

  if (isStaticProbe404(event.url.pathname))
    return createFast404Response(event.req.method)
})
