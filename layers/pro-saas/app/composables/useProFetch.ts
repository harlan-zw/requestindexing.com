import type { TypedFetch } from 'nuxt/app'

/**
 * Returns the pro layer's custom `$fetch` instance. Use this for every
 * `/api/pro/**` call so the 403 SITES_LIMIT_REACHED / 409 STATE_CHANGED
 * billing-state responses are handled in one place.
 *
 * For `useFetch` / `useLazyFetch` / `useAsyncData`, pass it as the
 * `$fetch` option: `useFetch('/api/pro/x', { $fetch: useProFetch() })`.
 */
export function useProFetch(): TypedFetch {
  return useNuxtApp().$proFetch
}
