/**
 * Where the indexing freshness label gets its time.
 *
 * gscdump never sets `meta.rollupBuiltAt`, so the label reads two other fields:
 * `capture.capturedAt` (gscdump 4.6.0 and later) and the newest inspection
 * check (`getIndexing().summary.newestCheck`, present on every host).
 */
export type IndexingFreshness
  = | { _tag: 'capture', at: number }
    | { _tag: 'newest-check', at: number }
    | { _tag: 'unknown' }

interface IndexingFreshnessInput {
  /** Response of the indexing diagnostics operation. */
  diagnostics?: unknown
  /** Response of the indexing summary operation. */
  indexing?: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

/** Parse an ISO string, epoch seconds, or epoch milliseconds into milliseconds. */
function parseTime(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0)
      return null
    return value > 10_000_000_000 ? value : value * 1000
  }
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function resolveIndexingFreshness(input: IndexingFreshnessInput): IndexingFreshness {
  const capturedAt = parseTime(record(record(input.diagnostics)?.capture)?.capturedAt)
  if (capturedAt !== null)
    return { _tag: 'capture', at: capturedAt }
  const newestCheck = parseTime(record(record(input.indexing)?.summary)?.newestCheck)
  if (newestCheck !== null)
    return { _tag: 'newest-check', at: newestCheck }
  return { _tag: 'unknown' }
}

function age(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000))
  if (minutes < 1)
    return 'just now'
  if (minutes < 60)
    return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

/** The label text, or null when no source carries a time. */
export function formatIndexingFreshness(freshness: IndexingFreshness, now: number): string | null {
  switch (freshness._tag) {
    case 'capture': {
      return `updated ${age(freshness.at, now)}`
    }
    case 'newest-check': {
      const text = age(freshness.at, now)
      return text === 'just now' ? 'last checked just now' : `last checked ${text}`
    }
    case 'unknown':
      return null
  }
}
