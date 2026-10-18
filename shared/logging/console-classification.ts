import type { GscdumpRealtimeV1ErrorCode, GscdumpV1SdkErrorCode } from '@gscdump/sdk/v1'
import type { LogName } from './catalog'

const CLIENT_EVENTS = new Set<LogName>([
  'auth.optional_probe_failed',
  'gscdump.integration.probe_failed',
  'gscdump.table_cell.unresolved',
])

const ERROR_CODES = new Set<string>([
  'cursor_store_failed',
  'effect_failed',
  'heartbeat_stale',
  'integration_failed',
  'protocol_error',
  'resync_failed',
  'runtime_unavailable',
  'socket_error',
  'ticket_invalid',
  'ticket_provider_failed',
  'upgrade_rejected',
  'aborted',
  'credential_resolution',
  'network_error',
  'request_validation',
  'response_validation',
  'invalid_request',
  'unauthorized',
  'forbidden',
  'user_not_found',
  'site_not_found',
  'api_key_not_found',
  'api_key_limit_reached',
  'rate_limited',
  'conflict',
  'service_unavailable',
  'realtime_unavailable',
  'internal_error',
  'contract_violation',
] satisfies (GscdumpRealtimeV1ErrorCode | GscdumpV1SdkErrorCode)[])

const ERROR_TYPES = new Set(['Error', 'TypeError', 'AbortError', 'FetchError', 'GscdumpV1Error', 'GscdumpRealtimeV1Error'])
const CONTEXT_VALUES: Record<string, readonly string[]> = {
  source: ['realtime'],
  stage: ['connect', 'load'],
  trigger: ['activate', 'focus', 'interval'],
  probe: ['refreshCaller'],
  fn: ['invalidateNuxtQueries'],
  read: ['top-association'],
}

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object')
    return undefined
  // FetchError exposes HTTP status through a getter. A broken getter must not
  // prevent the original warning or any of its sinks from receiving the entry.
  try {
    return (value as Record<string, unknown>)[key]
  }
  catch {
    return undefined
  }
}

function classifyError(parts: string[], error: unknown, prefix = ''): void {
  const type = field(error, 'name')
  if (typeof type === 'string' && ERROR_TYPES.has(type))
    parts.push(`${prefix}type=${type}`)
  const code = field(error, 'code')
  if (typeof code === 'string' && ERROR_CODES.has(code))
    parts.push(`${prefix}code=${code}`)
  const status = field(error, 'status') ?? field(error, 'statusCode')
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599)
    parts.push(`${prefix}status=${status}`)
  for (const key of ['retryable', 'terminal']) {
    const value = field(error, key)
    if (typeof value === 'boolean')
      parts.push(`${prefix}${key}=${value}`)
  }
}

/** Readable console fields, never free-form error, response, or context data. */
export function consoleClassification(name: LogName, error: unknown, ctx?: Record<string, unknown>): string {
  if (!CLIENT_EVENTS.has(name))
    return ''
  const parts = [`event=${name}`]
  for (const [key, values] of Object.entries(CONTEXT_VALUES)) {
    const value = field(ctx, key)
    if (typeof value === 'string' && values.includes(value))
      parts.push(`${key}=${value}`)
  }
  classifyError(parts, error)
  // Realtime wraps HTTP failures. Preserve only the immediate cause's safe
  // classification before the logger normalizes the error to message/stack.
  classifyError(parts, field(error, 'cause'), 'cause_')
  return parts.join(' ')
}
