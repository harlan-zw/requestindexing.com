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

function gscdumpConfig(event?: H3Event): GscdumpConfig {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  return (config.gscdump ?? {}) as GscdumpConfig
}

export function getGscdumpApiUrl(event?: H3Event): string {
  return normalizeGscdumpApiUrl(gscdumpConfig(event).apiUrl)
}

/**
 * The callback URL gscdump delivers webhooks to, passed on every site
 * registration. Override with `NUXT_GSCDUMP_WEBHOOK_URL` in dev/preview so the
 * webhook path is testable outside production.
 */
export function getGscdumpWebhookUrl(event?: H3Event): string {
  return normalizeGscdumpWebhookUrl(gscdumpConfig(event).webhookUrl)
}

/** Public v1 client for operations in the frozen registry. */
export function createGscdumpPublicV1Client(event?: H3Event, options?: { attempts?: number }) {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  const apiKey = config.gscdump?.apiKey
  if (!apiKey)
    throw createError({ statusCode: 500, message: 'GSCDUMP_API_KEY not configured' })
  return createGscdumpV1Client({
    apiRoot: getGscdumpApiUrl(event),
    credential: apiKey,
    ...(options?.attempts === undefined ? {} : { retry: { maxAttempts: options.attempts } }),
  })
}
