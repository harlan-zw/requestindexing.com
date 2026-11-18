import type { NuxtApp } from 'nuxt/app'
import type { WatchSource } from 'vue'
import { useProGscdump } from './useProGscdump'

export interface GscdumpQueryOptions {
  immediate?: boolean
  watch?: boolean
  /**
   * Reuse a value the server wrote into the SSR payload under this query's key.
   * Only the initial run reads it: the server render and client hydration see
   * the same rows, so the HTML carries them and hydration does not refetch.
   * Watch-triggered runs and manual refreshes always fetch.
   *
   * nuxtseo.com names this `ssrPayloadStaleTimeMs`, because its tables mount
   * inside `<ClientOnly>` and need a stale window after hydration. These tables
   * render on the server, so the hydration pass is the whole window.
   */
  seedFromSsrPayload?: boolean
  /**
   * `defer` lets several callers share one read by key: a second caller while
   * the read is in flight waits for it. Nuxt's default, `cancel`, restarts it,
   * so each caller would read again.
   */
  dedupe?: 'cancel' | 'defer'
}

/**
 * `getCachedData` for queries that opt into SSR payload seeding. It returns the
 * seeded value during the server render and client hydration, and nothing
 * afterwards, so a later mount of the same key fetches fresh rows.
 */
export function ssrPayloadSeed<T>(key: string, nuxtApp: NuxtApp, ctx: { cause: string }): T | undefined {
  if (ctx.cause !== 'initial')
    return undefined
  if (!import.meta.server && !nuxtApp.isHydrating)
    return undefined
  return nuxtApp.payload.data[key] as T | undefined
}

/**
 * Factory for v1 gscdump useAsyncData queries (indexing, sitemaps).
 *
 * Indexing and sitemap callers receive the typed client so public operations
 * cannot fall back to legacy path strings.
 *
 * `signal` aborts when Nuxt cancels the run: a refresh, a key change, or an
 * unmount. A caller that makes several requests should stop on it, because a
 * cancelled run's result is discarded but its requests still spend quota.
 */
export function useGscdumpQuery<T>(
  key: MaybeRefOrGetter<string>,
  siteId: MaybeRefOrGetter<string | undefined>,
  fn: (siteId: string, gscdump: ReturnType<typeof useProGscdump>, signal: AbortSignal) => Promise<T>,
  watchSources: WatchSource[],
  options?: GscdumpQueryOptions,
) {
  const _siteId = computed(() => toValue(siteId))
  const gscdump = useProGscdump()
  const shouldWatch = options?.watch ?? true
  return useAsyncData<T>(key, async (_nuxtApp, { signal }) => {
    if (!_siteId.value)
      return null as unknown as T
    return fn(_siteId.value, gscdump, signal)
  }, {
    server: false,
    immediate: options?.immediate ?? true,
    ...(options?.dedupe ? { dedupe: options.dedupe } : {}),
    ...(options?.seedFromSsrPayload ? { getCachedData: ssrPayloadSeed<T> } : {}),
    ...(shouldWatch ? { watch: [_siteId, ...watchSources] } : {}),
  })
}
