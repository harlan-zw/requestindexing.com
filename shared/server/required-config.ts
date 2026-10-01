/**
 * Secrets the Worker refuses to serve without.
 *
 * `scripts/deploy-cloudflare.ts` checks the same set before a scripted deploy,
 * but a deploy that bypasses the script ships whatever the build baked in.
 * When `NUXT_SESSION_PASSWORD` is missing, the Worker boots fine and then
 * every signed-in request dies inside iron-webcrypto with `Empty password`,
 * an error that names neither the cause nor the fix.
 */
export interface RequiredConfigSecret {
  /** Dot path on the runtime config object, e.g. `session.password`. */
  path: string
  /** Environment variable (or Worker secret) that overrides the path. */
  env: string
}

export const REQUIRED_CONFIG_SECRETS: readonly RequiredConfigSecret[] = [
  { env: 'NUXT_DATAFORSEO_LOGIN', path: 'dataforseo.login' },
  { env: 'NUXT_DATAFORSEO_PASSWORD', path: 'dataforseo.password' },
  { env: 'NUXT_GSCDUMP_API_KEY', path: 'gscdump.apiKey' },
  { env: 'NUXT_GSCDUMP_WEBHOOK_SECRET', path: 'gscdump.webhookSecret' },
  { env: 'NUXT_KEY', path: 'key' },
  { env: 'NUXT_OAUTH_GOOGLE_CLIENT_SECRET', path: 'oauth.google.clientSecret' },
  { env: 'NUXT_POSTMARK_API_KEY', path: 'postmark.apiKey' },
  { env: 'NUXT_SESSION_PASSWORD', path: 'session.password' },
]

/**
 * What the required-secret check found.
 *
 * `missing` carries every missing secret at once, so one boot message lists
 * the full fix instead of revealing one gap per deploy.
 */
export type ResolvedRequiredConfig
  = | { _tag: 'ok' }
    | { _tag: 'missing', secrets: RequiredConfigSecret[] }

function pickPath(config: unknown, path: string): unknown {
  let current: unknown = config
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null)
      return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Read each required secret off a runtime config object, keyed by env name.
 *
 * Nitro applies `NUXT_*` env overrides (Worker secrets included) to the
 * runtime config before it is read, so no second env lookup happens here.
 */
export function readConfigSecrets(
  required: readonly RequiredConfigSecret[],
  config: unknown,
): Record<string, unknown> {
  return Object.fromEntries(
    required.map(({ env, path }) => [env, pickPath(config, path)]),
  )
}

/**
 * Classify resolved secret values.
 *
 * `undefined`, `null`, and `''` count as missing, matching
 * `resolveWorkerSecrets` in `@harlan-zw/nuxt-cloudflare/deploy`.
 */
export function resolveRequiredConfig(
  required: readonly RequiredConfigSecret[],
  values: Record<string, unknown>,
): ResolvedRequiredConfig {
  const missing = required.filter(({ env }) => {
    const value = values[env]
    return value === undefined || value === null || value === ''
  })

  return missing.length > 0 ? { _tag: 'missing', secrets: missing } : { _tag: 'ok' }
}
