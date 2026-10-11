export const SENTRY_DSN = 'https://285c1e24a3cb947359ebc30e95ad7746@o4510507748163584.ingest.us.sentry.io/4511887363080192'

/**
 * The Report Policy `@harlan-zw/nuxt-sentry` enforces for this site. A 404 is
 * an answer the app gives on purpose, from the marketing catch-all page for a
 * missing guide and from the `/_og` middleware for a stale social card, so it
 * never reports. The client list keeps the module defaults: 401 and 403 are an
 * expired session racing the login redirect.
 */
export const reportPolicy = {
  dropServerStatus: [404],
  dropClientStatus: [401, 403, 404],
}

/**
 * HTTP status carried by an error, across the shapes this app produces:
 * `statusCode` on an H3Error, `status` on a fetch failure, and `data.statusCode`
 * on a NuxtError serialised across the SSR boundary.
 */
export function errorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object')
    return undefined

  const record = error as {
    statusCode?: unknown
    status?: unknown
    data?: { statusCode?: unknown } | null
    cause?: unknown
  }

  const candidates = [record.statusCode, record.status, record.data?.statusCode]
  const status = candidates.find(value => typeof value === 'number') as number | undefined
  if (status !== undefined)
    return status

  return record.cause && record.cause !== error ? errorStatusCode(record.cause) : undefined
}
