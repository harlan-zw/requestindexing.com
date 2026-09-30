// Server-side Sentry sink for the `logWarn`/`logError` chokepoint in
// `shared/logging/`. Catalogued best-effort failures become Sentry reports:
// entries carrying an error become exceptions, warn entries without one
// become messages carrying the catalog description.
//
// The capture is fingerprinted by the catalogued `name`, so each failure
// mode groups into its own Sentry issue no matter how the message text
// (paths, ids, upstream statuses) varies.
//
// `@sentry/cloudflare` is the server SDK this deployment runs on: the
// `@harlan-zw/nuxt-sentry` plugin initializes it around every request, so
// captures made at request time land inside the request's Sentry scope and
// flow through the shared Report Policy (drop + redaction rules).
//
// Best-effort: the chokepoint in `shared/logging/` already isolates a
// throwing sink, so a Sentry outage can never poison the request that
// triggered the original log.

import { captureException, captureMessage, withScope } from '@sentry/cloudflare'
import { addLogSink } from '~~/shared/logging'

function toSentryException(error: { message: string, stack?: string }): Error {
  const reconstructed = new Error(error.message)
  reconstructed.stack = error.stack
  return reconstructed
}

export default defineNitroPlugin(() => {
  if (import.meta.prerender)
    return

  addLogSink((entry) => {
    withScope((scope) => {
      scope.setTag('log.name', entry.name)
      scope.setTag('log.level', entry.level)
      scope.setContext('catalog', { description: entry.description })
      if (entry.ctx)
        scope.setContext('ctx', entry.ctx)
      scope.setFingerprint([entry.name])
      const level = entry.level === 'warn' ? 'warning' : 'error'
      scope.setLevel(level)

      if (entry.error) {
        captureException(toSentryException(entry.error))
      }
      else {
        captureMessage(entry.description, level)
      }
    })
  })
})
