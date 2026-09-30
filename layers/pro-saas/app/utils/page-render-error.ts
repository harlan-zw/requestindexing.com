// Vue labels the source of a captured error in `info`: a readable name in a
// development build, and a link that ends in the error code in production.
// https://vuejs.org/error-reference/#runtime-errors
const PRODUCTION_INFO_PREFIX = 'https://vuejs.org/error-reference/#runtime-'

// Work that runs after the page rendered: event handlers and watcher
// callbacks. When it fails, the page is still on screen and still works.
const AFTER_RENDER_SOURCES = new Set([
  'watcher callback',
  'native event handler',
  'component event handler',
  '3',
  '5',
  '6',
])

/**
 * Whether a captured error stopped the page from rendering, so the dashboard
 * boundary should replace the page with its notice. `info` is the third
 * argument of `onErrorCaptured`.
 */
export function isPageRenderError(info: string): boolean {
  const source = info.startsWith(PRODUCTION_INFO_PREFIX) ? info.slice(PRODUCTION_INFO_PREFIX.length) : info
  return !AFTER_RENDER_SOURCES.has(source)
}
