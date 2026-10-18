// Single chokepoint for the "best-effort failure" pattern. See ADR-0022.
//
// Usage:
//
//   import { logWarn } from '~~/shared/logging'
//   .catch(err => logWarn('agency_overage.meter_failed', err, { customerId }))
//
// Pipeline:
//   1. `log.warn` from evlog → dev pretty-print + Sentry/Axiom adapters.
//   2. Every `LogSink` registered via `addLogSink` receives the structured
//      record. Server-side, `layers/pro-saas/server/plugins/evlog-d1-drain.ts`
//      persists each entry to the `runtime_errors` D1 table and
//      `layers/pro-saas/server/plugins/evlog-sentry-drain.ts` reports
//      warn/error entries to Sentry. Client-side no sink is registered, so
//      logs only land in the browser console + any client transport
//      configured on evlog.
//
// The sink seam is what lets the same call site work in both runtime graphs
// without `shared/` knowing about D1, Drizzle, Sentry, or H3.

import type { LogName } from './catalog'
import { LOG_CATALOG } from './catalog'
import { consoleClassification } from './console-classification'

// Local shim for evlog (package not yet installed). Mirrors the surface used
// below: `log.warn(payload)`, `log.error(payload)`, and `parseError(err)`.
const log = {
  warn: (payload: unknown, classification: string) => console.warn(`[evlog:warn]${classification ? ` ${classification}` : ''}`, payload),
  error: (payload: unknown, classification: string) => console.error(`[evlog:error]${classification ? ` ${classification}` : ''}`, payload),
}
function parseError(error: unknown): { message: string, stack?: string } {
  if (error instanceof Error)
    return { message: error.message, stack: error.stack }
  return { message: String(error) }
}

export { LOG_CATALOG }
export type { LogName }

export interface LogSinkEntry {
  level: 'warn' | 'error'
  name: LogName
  description: string
  error: ReturnType<typeof parseError> | null
  ctx: Record<string, unknown> | null
}

export type LogSink = (entry: LogSinkEntry) => void

const sinks = new Set<LogSink>()

export function addLogSink(sink: LogSink): void {
  sinks.add(sink)
}

export function removeLogSink(sink: LogSink): void {
  sinks.delete(sink)
}

function emit(level: 'warn' | 'error', name: LogName, error: unknown, ctx?: Record<string, unknown>): void {
  const classification = consoleClassification(name, error, ctx)
  const parsed = error == null ? null : parseError(error)
  const description = LOG_CATALOG[name]

  // evlog pipeline: dev pretty-print + external drains (Sentry, etc.).
  log[level]({
    name,
    description,
    error: parsed,
    ...(ctx ? { ctx } : {}),
  }, classification)

  // Server-installed sinks (D1, Sentry, ...). Wrapped per sink so a
  // misbehaving sink can never re-enter the catch path that called us,
  // and can never block the remaining sinks.
  const entry: LogSinkEntry = { level, name, description, error: parsed, ctx: ctx ?? null }
  for (const sink of sinks) {
    try {
      sink(entry)
    }
    catch (sinkErr) {
      console.error('[logging] sink threw', sinkErr)
    }
  }
}

export function logWarn(name: LogName, error: unknown, ctx?: Record<string, unknown>): void {
  emit('warn', name, error, ctx)
}

export function logError(name: LogName, error: unknown, ctx?: Record<string, unknown>): void {
  emit('error', name, error, ctx)
}
