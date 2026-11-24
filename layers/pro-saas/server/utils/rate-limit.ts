import type { H3Event } from 'h3'
import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'
import { logWarn } from '~~/shared/logging'
// `appStorage` historically pointed at `useStorage('cache')` in nuxtseo.com.
// We use the Nitro built-in directly to avoid a host-level shim.
const appStorage = () => useStorage('cache')

// Free-only beta: one tier for authenticated callers, a stricter one for
// anonymous requests. No subscription tier to branch on.
export type Tier = 'anon' | 'free'

interface RateLimiter {
  limit: (opts: { key: string }) => Promise<{ success: boolean }>
}

export const DAILY_LIMITS: Record<Tier, number> = {
  anon: 2,
  free: 100,
}

export const MINUTE_BINDINGS: Record<Tier, string> = {
  anon: 'RL_PRO_ANON',
  free: 'RL_PRO_FREE',
}

export function getClientKeyFromIp(ip: string | undefined, userId?: string): string {
  if (userId)
    return `user:${userId}`
  return `ip:${ip || 'unknown'}`
}

function getClientKey(event: H3Event, userId?: string): string {
  if (userId)
    return `user:${userId}`

  // Fallback to IP for anonymous
  const ip = getHeader(event, 'cf-connecting-ip')
    || getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestIP(event)
    || 'unknown'

  return `ip:${ip}`
}

export function getEndOfDayTimestamp(): number {
  const now = new Date()
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.floor(endOfDay.getTime() / 1000)
}

export function isOverDailyLimit(count: number | null, tier: Tier): boolean {
  return count !== null && count >= DAILY_LIMITS[tier]
}

export function getRemainingRequests(count: number | null, tier: Tier): number {
  return DAILY_LIMITS[tier] - (count || 0) - 1
}

const FREE_TOOL_DAILY_LIMIT = 50

export async function checkFreeToolRateLimit(event: H3Event) {
  // Skip rate limiting in development
  if (import.meta.dev)
    return

  const ip = getHeader(event, 'cf-connecting-ip')
    || getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestIP(event)
    || 'unknown'
  const key = `ip:${ip}`

  // Per-minute check (native Cloudflare binding)
  const cf = resolveCloudflareBindings<Record<string, RateLimiter>>(event)
  const limiter = cf?.RL_FREE_TOOLS

  if (limiter) {
    const { success } = await limiter.limit({ key })
    if (!success) {
      setResponseHeaders(event, {
        'X-RateLimit-Limit': String(FREE_TOOL_DAILY_LIMIT),
        'Retry-After': '60',
      })
      throw createError({
        statusCode: 429,
        message: 'Rate limit exceeded. Please wait before making more requests.',
      })
    }
  }

  // Per-day check (KV storage)
  const today = new Date().toISOString().slice(0, 10)
  const dayKey = `ratelimit:tool:${key}:${today}`
  const storage = appStorage()

  const count = await storage.getItem<number>(dayKey).catch(() => null)

  if (count !== null && count >= FREE_TOOL_DAILY_LIMIT) {
    setResponseHeaders(event, {
      'X-RateLimit-Limit': String(FREE_TOOL_DAILY_LIMIT),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(getEndOfDayTimestamp()),
    })
    throw createError({
      statusCode: 429,
      message: `Daily limit of ${FREE_TOOL_DAILY_LIMIT} requests exceeded. Resets at midnight UTC.`,
    })
  }

  await storage.setItem(dayKey, (count || 0) + 1, { ttl: 86400 }).catch(err => logWarn('kv.best_effort_write_failed', err, { fn: 'rateLimit.increment', dayKey }))

  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(FREE_TOOL_DAILY_LIMIT),
    'X-RateLimit-Remaining': String(FREE_TOOL_DAILY_LIMIT - (count || 0) - 1),
  })
}

export async function checkProToolRateLimit(
  event: H3Event,
  opts: { userId?: string },
) {
  const tier: Tier = opts.userId ? 'free' : 'anon'
  const key = getClientKey(event, opts.userId)

  // Per-minute check (native Cloudflare binding)
  const cf = resolveCloudflareBindings<Record<string, RateLimiter>>(event)
  const limiter = cf?.[MINUTE_BINDINGS[tier]]

  if (limiter) {
    const { success } = await limiter.limit({ key })
    if (!success) {
      setResponseHeaders(event, {
        'X-RateLimit-Limit': String(DAILY_LIMITS[tier]),
        'X-RateLimit-Tier': tier,
        'Retry-After': '60',
      })
      throw createError({
        statusCode: 429,
        message: 'Rate limit exceeded. Please wait before making more requests.',
      })
    }
  }

  // Per-day check (KV storage) - skip if unavailable
  const today = new Date().toISOString().slice(0, 10)
  const dayKey = `ratelimit:${key}:${today}`
  const storage = appStorage()

  const count = await storage.getItem<number>(dayKey).catch(() => null)

  if (count !== null && count >= DAILY_LIMITS[tier]) {
    setResponseHeaders(event, {
      'X-RateLimit-Limit': String(DAILY_LIMITS[tier]),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Tier': tier,
      'X-RateLimit-Reset': String(getEndOfDayTimestamp()),
    })
    throw createError({
      statusCode: 429,
      message: `Daily limit of ${DAILY_LIMITS[tier]} requests exceeded. Resets at midnight UTC.`,
    })
  }

  // Increment counter (ignore errors in dev)
  await storage.setItem(dayKey, (count || 0) + 1, { ttl: 86400 }).catch(err => logWarn('kv.best_effort_write_failed', err, { fn: 'rateLimit.increment', dayKey }))

  // Set rate limit headers
  setResponseHeaders(event, {
    'X-RateLimit-Limit': String(DAILY_LIMITS[tier]),
    'X-RateLimit-Remaining': String(getRemainingRequests(count, tier)),
    'X-RateLimit-Tier': tier,
  })
}
