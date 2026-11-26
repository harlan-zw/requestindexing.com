import { createFast404Response } from '~~/shared/server/static-probe-404'

/**
 * `ogImage.zeroRuntime` strips the OG image renderer from the worker, so the
 * only OG images that exist are the files written during prerendering. Those
 * are served by the static asset layer and never reach this handler.
 *
 * A `/_og/**` request arriving here therefore asks for an image that does not
 * exist: a stale social card URL from an older deploy, or a crawler guessing.
 * Answer with a fast plain-text 404 instead of rendering `error.vue` through
 * Nuxt SSR or letting the stripped renderer throw a 500.
 *
 * Dev and prerendering still render on demand, matching the module's own
 * zero-runtime handler.
 */
export default defineEventHandler((event) => {
  if (import.meta.dev || import.meta.prerender)
    return

  const pathname = event.url?.pathname ?? event.path.split('?', 1)[0]!
  if (pathname === '/_og' || pathname.startsWith('/_og/'))
    return createFast404Response(event.req.method)
})
