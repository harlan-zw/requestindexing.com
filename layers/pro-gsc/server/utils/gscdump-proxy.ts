// Server-to-server proxy for the gscdump.com user-settings endpoint.
//
// Integration metadata reads one valid preference and caches it for 60 seconds.
// Optional reads share an 800 ms budget. A failure never becomes a cached opt-in.

import type { GscdumpUserSettings } from '@gscdump/contracts'
import type { PartnerFetch } from '@gscdump/sdk/partner'
import type { H3Event } from 'h3'
import { createPartnerClient } from '@gscdump/sdk/partner'
import { createError } from 'h3'
import { logWarn } from '~~/shared/logging'
import { getGscdumpApiUrl } from './gscdump-origin'

const TTL_SECONDS = 60
const SETTINGS_READ_TIMEOUT_MS = 800
const cacheKey = (userId: number): string => `gsc:settings:${userId}`

type ParsedSettings = { _tag: 'Parsed', settings: GscdumpUserSettings } | { _tag: 'Invalid', cause: unknown }
type SettingsRead
  = | { _tag: 'Available', settings: GscdumpUserSettings, source: 'cache' | 'upstream' }
    | { _tag: 'Unavailable', cause: unknown, reason: 'timeout' | 'read' | 'malformed' }

function parseSettings(value: unknown): ParsedSettings {
  if (typeof value === 'object' && value !== null && 'browserAnalyzerEnabled' in value && typeof value.browserAnalyzerEnabled === 'boolean')
    return { _tag: 'Parsed', settings: { browserAnalyzerEnabled: value.browserAnalyzerEnabled } }
  return { _tag: 'Invalid', cause: new Error('Invalid browser analyzer preference') }
}

function parseCachedSettings(raw: string): ParsedSettings {
  try {
    return parseSettings(JSON.parse(raw))
  }
  catch (cause) {
    return { _tag: 'Invalid', cause }
  }
}

function getKV(event: H3Event): KVNamespace | null {
  const env = event.context.cloudflare?.env as { KV?: KVNamespace } | undefined
  return env?.KV ?? null
}

function createSettingsClient(event: H3Event, apiKey: string, signal?: AbortSignal) {
  const fetch = $fetch as unknown as PartnerFetch
  return createPartnerClient({
    apiBase: getGscdumpApiUrl(event),
    apiKey,
    fetch: signal
      ? ((path, init) => fetch(path, { ...init, signal, retry: 0 })) as PartnerFetch
      : fetch,
  })
}

async function readSettings(event: H3Event, userId: number, apiKey: string, kv: KVNamespace | null, signal: AbortSignal): Promise<SettingsRead> {
  if (kv) {
    const cached = await kv.get(cacheKey(userId))
    signal.throwIfAborted()
    if (cached) {
      const parsed = parseCachedSettings(cached)
      if (parsed._tag === 'Parsed')
        return { _tag: 'Available', settings: parsed.settings, source: 'cache' }
      logWarn('gscdump.proxy.failed', parsed.cause, { stage: 'settings.cache', reason: 'malformed', userId })
    }
  }
  signal.throwIfAborted()
  const parsed = parseSettings(await createSettingsClient(event, apiKey, signal).getUserSettings())
  return parsed._tag === 'Parsed'
    ? { _tag: 'Available', settings: parsed.settings, source: 'upstream' }
    : { _tag: 'Unavailable', cause: parsed.cause, reason: 'malformed' }
}

export async function loadGscdumpSettings(
  event: H3Event,
  userId: number,
  apiKey: string | null,
): Promise<GscdumpUserSettings> {
  if (!apiKey)
    return { browserAnalyzerEnabled: false }

  const kv = getKV(event)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<SettingsRead>((resolve) => {
    timer = setTimeout(() => {
      const cause = new Error('Optional settings read exceeded 800 ms')
      resolve({ _tag: 'Unavailable', cause, reason: 'timeout' })
      controller.abort(cause)
    }, SETTINGS_READ_TIMEOUT_MS)
  })
  const read = readSettings(event, userId, apiKey, kv, controller.signal)
    .catch((cause): SettingsRead => ({ _tag: 'Unavailable', cause, reason: 'read' }))
  const result = await Promise.race([read, deadline]).finally(() => clearTimeout(timer))

  if (result._tag === 'Unavailable') {
    logWarn('gscdump.proxy.failed', result.cause, { stage: 'settings.get', reason: result.reason, userId })
    return { browserAnalyzerEnabled: false }
  }

  // Preserve the existing cache-write barrier. The read budget excludes this write.
  if (kv && result.source === 'upstream') {
    await kv.put(cacheKey(userId), JSON.stringify(result.settings), { expirationTtl: TTL_SECONDS })
      .catch(err => logWarn('kv.best_effort_write_failed', err, { fn: 'gscdumpSettings.cacheWrite', userId }))
  }
  return result.settings
}

export async function patchGscdumpSettings(
  event: H3Event,
  userId: number,
  apiKey: string | null,
  body: Partial<GscdumpUserSettings>,
): Promise<GscdumpUserSettings> {
  if (!apiKey)
    return { browserAnalyzerEnabled: true }

  const updated = await createSettingsClient(event, apiKey).patchUserSettings(body).catch((error) => {
    logWarn('gscdump.proxy.failed', error, { stage: 'settings.patch', userId })
    return null
  })

  if (!updated) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to update gscdump settings',
    })
  }

  const parsed = parseSettings(updated)
  if (parsed._tag === 'Invalid') {
    logWarn('gscdump.proxy.failed', parsed.cause, { stage: 'settings.patch', reason: 'malformed', userId })
    throw createError({ statusCode: 502, statusMessage: 'Failed to update gscdump settings' })
  }
  const out = parsed.settings

  // Bust the cache so the next integration read returns the fresh value.
  const kv = getKV(event)
  if (kv)
    await kv.delete(cacheKey(userId)).catch(err => logWarn('kv.best_effort_write_failed', err, { fn: 'gscdumpSettings.cacheBust', userId }))

  return out
}

export async function invalidateGscdumpSettings(event: H3Event, userId: number): Promise<void> {
  const kv = getKV(event)
  if (!kv)
    return
  await kv.delete(cacheKey(userId)).catch(err => logWarn('kv.best_effort_write_failed', err, { fn: 'invalidateGscdumpSettings', userId }))
}
