import type { TypedFetch } from 'nuxt/app'

/** Resolve Nuxt's current runtime client without capturing it during import. */
export function getAppFetch(): TypedFetch {
  // Nuxt's generated fetch module exports this same ofetch client. The native
  // TypedFetch contract adds route inference without changing its runtime API.
  return globalThis.$fetch as TypedFetch
}
