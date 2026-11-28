import { describe, expect, it } from 'vitest'
import {
  normalizeToolDomainCacheKey,
  normalizeToolUrlCacheKey,
  readToolResultCache,
  writeToolResultCache,
} from '../layers/core/server/app/services/tool-cache'

function createMemoryCache() {
  const store = new Map<string, { value: unknown, ttl: number }>()
  return {
    store,
    storage: {
      getItem: async <T = unknown>(key: string) => (store.get(key)?.value as T | undefined) ?? null,
      setItem: async (key: string, value: unknown, opts?: { ttl: number }) => {
        store.set(key, { value, ttl: opts?.ttl ?? 0 })
      },
    },
  }
}

describe('tool cache keys', () => {
  it('normalizes host case, missing scheme, and trailing slash on non-root paths', () => {
    expect(normalizeToolUrlCacheKey('Example.COM/blog/post/')).toBe(
      normalizeToolUrlCacheKey('https://example.com/blog/post'),
    )
    expect(normalizeToolUrlCacheKey('https://EXAMPLE.com/')).toBe(
      'tool-cache:v1:check-index:https://example.com/',
    )
  })

  it('keeps distinct query strings and path casing as separate cache keys', () => {
    expect(normalizeToolUrlCacheKey('https://example.com/Post')).not.toBe(
      normalizeToolUrlCacheKey('https://example.com/post'),
    )
    expect(normalizeToolUrlCacheKey('https://example.com/page?a=1')).not.toBe(
      normalizeToolUrlCacheKey('https://example.com/page?a=2'),
    )
  })

  it('normalizes domains regardless of scheme, path, or case', () => {
    expect(normalizeToolDomainCacheKey('HTTPS://Example.COM/foo/bar')).toBe(
      'tool-cache:v1:site-report:example.com',
    )
  })
})

describe('tool cache read/write', () => {
  it('round-trips cached payloads with TTL', async () => {
    const { storage, store } = createMemoryCache()
    const key = normalizeToolUrlCacheKey('https://example.com/page')
    await writeToolResultCache(storage, key, { indexed: true }, 1800)

    expect(await readToolResultCache<{ indexed: boolean }>(storage, key)).toEqual({ indexed: true })
    expect(store.get(key)?.ttl).toBe(1800)
  })

  it('degrades to a cache miss when storage throws', async () => {
    const broken = {
      getItem: async () => Promise.reject(new Error('KV down')),
      setItem: async () => Promise.reject(new Error('KV down')),
    }

    await expect(readToolResultCache(broken, 'k')).resolves.toBeNull()
    await expect(writeToolResultCache(broken, 'k', { ok: true }, 60)).resolves.toBeUndefined()
  })
})
