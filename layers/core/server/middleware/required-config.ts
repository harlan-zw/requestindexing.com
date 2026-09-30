import type { ResolvedRequiredConfig } from '~~/shared/server/required-config'
/**
 * Runtime-secret guard: the last check a misconfigured deploy cannot skip.
 *
 * `scripts/deploy-cloudflare.ts` validates the secrets for a scripted deploy.
 * A deploy that bypasses the script ships the build's empty defaults, and the
 * Worker then boots fine while every signed-in request dies inside
 * iron-webcrypto with `Empty password` (REQUEST-INDEXING-C).
 *
 * This handler runs before any route, once per Worker isolate, and fails the
 * request with a message naming every missing secret. It is a middleware
 * rather than a boot plugin because Nitro plugins run before the request
 * handler populates `process.env`, so Worker secrets are invisible at boot
 * time. Reading them per request is the only reliable moment.
 *
 * Prerendering runs inside the build, where deploy secrets are absent by
 * design, and dev reports missing services without throwing so a clone without `.env` still
 * boots.
 */
import { logger } from '~~/shared/server/logger'
import { readConfigSecrets, REQUIRED_CONFIG_SECRETS, resolveRequiredConfig } from '~~/shared/server/required-config'

let check: ResolvedRequiredConfig | undefined

export default defineEventHandler((event) => {
  if (import.meta.prerender)
    return

  check ||= resolveRequiredConfig(
    REQUIRED_CONFIG_SECRETS,
    readConfigSecrets(REQUIRED_CONFIG_SECRETS, useRuntimeConfig(event)),
  )

  if (check._tag === 'ok')
    return

  const names = check.secrets.map(({ env }) => env).join(', ')

  if (import.meta.dev) {
    logger.info(`Missing required config: ${names}. Set each value, then restart the dev server.`)
    return
  }

  throw createError({
    statusCode: 500,
    statusMessage: `Missing required config: ${names}. Set each secret, then redeploy.`,
  })
})
