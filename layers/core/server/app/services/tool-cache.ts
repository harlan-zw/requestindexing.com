import { logWarn } from '~~/shared/logging'

/**
 * Minimal structural cache surface matching Nitro's `useStorage('cache')` so
 * pure unit tests can pass an in-memory Map without Nitro globals.
 */
export interface ToolResultCacheStorage {
  getItem: <T = unknown>(key: string) => Promise<T | null>
  setItem: (key: string, value: unknown, opts?: { ttl: number }) => Promise<void>
}

export const CHECK_INDEX_CACHE_TTL_SECONDS = 1800 // 30 minutes
export const SITE_REPORT_CACHE_TTL_SECONDS = 7200 // 2 hours

/**
 * Normalize a checked URL into a deterministic cache key.
 * Preserves path case and query params (which can change indexing), while
 * lowercasing protocol/host and trimming a single trailing slash on non-root paths.
 */
export function normalizeToolUrlCacheKey(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  const withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname
    return `tool-cache:v1:check-index:${parsed.protocol}//${host}${path}${parsed.search}`
  }
  catch {
    return `tool-cache:v1:check-index:${withScheme.toLowerCase()}`
  }
}

export function normalizeToolDomainCacheKey(domain: string): string {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return `tool-cache:v1:site-report:${clean}`
}

export async function readToolResultCache<T>(storage: ToolResultCacheStorage, key: string): Promise<T | null> {
  return storage.getItem<T>(key).catch((err) => {
    logWarn('kv.best_effort_read_failed', err, { fn: 'toolCache.read', key })
    return null
  })
}

export async function writeToolResultCache(
  storage: ToolResultCacheStorage,
  key: string,
  value: unknown,
  ttl: number,
): Promise<void> {
  await storage.setItem(key, value, { ttl }).catch((err) => {
    logWarn('kv.best_effort_write_failed', err, { fn: 'toolCache.write', key })
  })
}
