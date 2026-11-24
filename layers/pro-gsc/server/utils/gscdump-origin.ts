import type { H3Event } from 'h3'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import {
  normalizeGscdumpApiUrl,
  normalizeGscdumpWebhookUrl,
} from '#layers/pro-gsc/shared/utils/gscdump-origin'

interface GscdumpConfig {
  apiUrl?: string
  apiKey?: string
  webhookUrl?: string
  webhookSecret?: string
}

function gscdumpConfig(): GscdumpConfig {
  const config = useRuntimeConfig()
  return (config.gscdump ?? {}) as GscdumpConfig
}

export function getGscdumpApiUrl(_event?: H3Event): string {
  return normalizeGscdumpApiUrl(gscdumpConfig().apiUrl)
}

/**
 * The callback URL gscdump delivers webhooks to, passed on every site
 * registration. Override with `NUXT_GSCDUMP_WEBHOOK_URL` in dev/preview so the
 * webhook path is testable outside production.
 */
export function getGscdumpWebhookUrl(_event?: H3Event): string {
  return normalizeGscdumpWebhookUrl(gscdumpConfig().webhookUrl)
}

/** Public v1 client for operations in the frozen registry. */
export function createGscdumpPublicV1Client(event?: H3Event, options?: { attempts?: number }) {
  const config = useRuntimeConfig()
  const apiKey = config.gscdump?.apiKey
  if (!apiKey)
    throw createError({ statusCode: 500, message: 'GSCDUMP_API_KEY not configured' })
  return createGscdumpV1Client({
    apiRoot: getGscdumpApiUrl(event),
    credential: apiKey,
    requestContext: { product: 'requestindexing', client: 'Request Indexing' },
    ...(options?.attempts === undefined ? {} : { retry: { maxAttempts: options.attempts } }),
  })
}
