/**
 * Mark a failure the `logWarn`/`logError` Sentry sink already reported, before
 * it rides as the `cause` of a thrown 5xx.
 *
 * The `@sentry/nuxt` Nitro `error` hook skips an H3 error whose cause carries
 * the non-enumerable `__sentry_captured__` mark (read with `in` by
 * `captureErrorHook.js`), so one failure reports once. The hook only inspects an
 * object cause, so a primitive is wrapped in an `Error` before marking.
 */
export function markCapturedBySentry(error: unknown): unknown {
  const cause = typeof error === 'object' && error !== null ? error : new Error(String(error))
  try {
    Object.defineProperty(cause, '__sentry_captured__', {
      value: true,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  catch {
    // Genuinely ignorable: a frozen/sealed cause cannot carry the mark, so
    // the hook adds a second capture instead of losing the failure entirely.
  }
  return cause
}
