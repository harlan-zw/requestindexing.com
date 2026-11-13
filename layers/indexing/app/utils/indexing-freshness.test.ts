import { describe, expect, it } from 'vitest'
import { formatIndexingFreshness, resolveIndexingFreshness } from './indexing-freshness'

const NOW = Date.parse('2026-09-30T12:00:00Z')

describe('resolveIndexingFreshness', () => {
  it('prefers capture.capturedAt over the newest check', () => {
    const result = resolveIndexingFreshness({
      diagnostics: { capture: { capturedAt: '2026-09-30T11:00:00Z' }, meta: {} },
      indexing: { summary: { newestCheck: '2026-09-29T00:00:00Z' } },
    })
    expect(result).toEqual({ _tag: 'capture', at: Date.parse('2026-09-30T11:00:00Z') })
  })

  it('falls back to the newest inspection check on an older host', () => {
    const result = resolveIndexingFreshness({
      diagnostics: { meta: {} },
      indexing: { summary: { newestCheck: '2026-09-29T00:00:00Z' } },
    })
    expect(result).toEqual({ _tag: 'newest-check', at: Date.parse('2026-09-29T00:00:00Z') })
  })

  it('accepts epoch seconds and milliseconds', () => {
    const at = Date.parse('2026-09-30T11:00:00Z')
    expect(resolveIndexingFreshness({ diagnostics: { capture: { capturedAt: at / 1000 } } }))
      .toEqual({ _tag: 'capture', at })
    expect(resolveIndexingFreshness({ diagnostics: { capture: { capturedAt: at } } }))
      .toEqual({ _tag: 'capture', at })
  })

  it('skips an unparseable capture and uses the newest check', () => {
    const result = resolveIndexingFreshness({
      diagnostics: { capture: { capturedAt: 'garbage' } },
      indexing: { summary: { newestCheck: '2026-09-29T00:00:00Z' } },
    })
    expect(result._tag).toBe('newest-check')
  })

  it('is unknown when nothing carries a time', () => {
    expect(resolveIndexingFreshness({})).toEqual({ _tag: 'unknown' })
    expect(resolveIndexingFreshness({ diagnostics: { capture: null }, indexing: { summary: { newestCheck: null } } }))
      .toEqual({ _tag: 'unknown' })
    expect(resolveIndexingFreshness({ diagnostics: 'x', indexing: 42 })).toEqual({ _tag: 'unknown' })
  })
})

describe('formatIndexingFreshness', () => {
  it('labels capture time as updated', () => {
    expect(formatIndexingFreshness({ _tag: 'capture', at: NOW - 5 * 60_000 }, NOW)).toBe('updated 5m ago')
    expect(formatIndexingFreshness({ _tag: 'capture', at: NOW - 30_000 }, NOW)).toBe('updated just now')
    expect(formatIndexingFreshness({ _tag: 'capture', at: NOW - 3 * 3_600_000 }, NOW)).toBe('updated 3h ago')
  })

  it('labels a newest check as checked, since it dates the inspection', () => {
    expect(formatIndexingFreshness({ _tag: 'newest-check', at: NOW - 2 * 3_600_000 }, NOW)).toBe('last checked 2h ago')
  })

  it('shows days after 48 hours', () => {
    expect(formatIndexingFreshness({ _tag: 'newest-check', at: NOW - 72 * 3_600_000 }, NOW)).toBe('last checked 3d ago')
  })

  it('returns null when unknown', () => {
    expect(formatIndexingFreshness({ _tag: 'unknown' }, NOW)).toBeNull()
  })
})
