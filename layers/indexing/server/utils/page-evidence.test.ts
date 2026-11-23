import { describe, expect, it, vi } from 'vitest'
import { inspectFirstReport, inspectSavedPage, readSavedFirstReport, readSavedPageEvidence } from './page-evidence'

const url = 'https://www.example.com/Case'
const evidence = { url, coverageState: 'Discovered - currently not indexed', verdict: 'NEUTRAL', lastCheckedAt: '2026-11-07T00:00:00Z', lastCrawlTime: null }

describe('the original page evidence', () => {
  it('does not count metadata-only rows as actual Google evidence', async () => {
    const metadata = { ...evidence, coverageState: null, verdict: null }
    expect(await readSavedPageEvidence(url, async () => ({ urls: [metadata] }), vi.fn())).toEqual({ _tag: 'Missing' })
    expect(await inspectFirstReport([url], async () => ({ results: [metadata], errors: [], skipped: [] }), vi.fn(), new Date())).toEqual({ _tag: 'Results', rows: [{ _tag: 'NoResult', url }] })
  })
  it('preserves a partial batch without inventing Google evidence for skipped or failed URLs', async () => {
    const inspect = vi.fn(async () => ({ results: [evidence], errors: [{ url: `${url}/failed`, error: 'permission_denied' }], skipped: [{ url: `${url}/skipped`, reason: 'daily_quota' }] }))
    expect(await inspectFirstReport([url, `${url}/failed`, `${url}/skipped`, `${url}/missing`], inspect, vi.fn(), new Date('2026-11-07T00:00:00Z'))).toMatchObject({
      _tag: 'Results',
      rows: [{ _tag: 'Evidence', evidence: { url } }, { _tag: 'Error', url: `${url}/failed`, reason: 'permission_denied' }, { _tag: 'Skipped', url: `${url}/skipped`, reason: 'daily_quota' }, { _tag: 'NoResult', url: `${url}/missing` }],
    })
    expect(inspect).toHaveBeenCalledOnce()
  })
  it('reads a negative saved verdict without triggering an inspection', async () => {
    const read = vi.fn(async () => ({ urls: [evidence] }))
    expect(await readSavedPageEvidence(url, read, vi.fn())).toMatchObject({ _tag: 'Evidence', evidence: { url, coverage: evidence.coverageState, capturedAt: evidence.lastCheckedAt } })
    expect(read).toHaveBeenCalledOnce()
  })

  it('does not substitute a nearby URL or an unavailable read for missing evidence', async () => {
    expect(await readSavedPageEvidence(url, async () => ({ urls: [{ ...evidence, url: 'https://example.com/Case' }] }), vi.fn())).toEqual({ _tag: 'Missing' })
    const report = vi.fn()
    expect(await readSavedPageEvidence(url, async () => {
      throw new Error('offline')
    }, report)).toEqual({ _tag: 'Unavailable', operation: 'read' })
    expect(report).toHaveBeenCalledOnce()
  })

  it('does not treat an accepted request with no URL result as evidence', async () => {
    expect(await inspectSavedPage(url, async () => ({ results: [], errors: [], skipped: [] }), vi.fn(), new Date())).toEqual({ _tag: 'Failed' })
  })

  it('finds an exact saved URL after the first substring-search page', async () => {
    const read = vi.fn(async (offset = 0) => offset === 0
      ? { urls: [{ ...evidence, url: `${url}/another` }], pagination: { offset: 0, limit: 1, hasMore: true } }
      : { urls: [evidence], pagination: { offset: 1, limit: 1, hasMore: false } })
    expect(await readSavedPageEvidence(url, read, vi.fn())).toMatchObject({ _tag: 'Evidence', evidence: { url } })
  })

  it('does not infer absence when the bounded search still has more pages', async () => {
    const read = vi.fn(async (offset: number) => ({ urls: [], pagination: { offset, limit: 100, hasMore: true } }))
    const report = vi.fn()
    expect(await readSavedPageEvidence(url, read, report)).toEqual({ _tag: 'Unavailable', operation: 'read' })
    expect(read).toHaveBeenCalledTimes(10)
    expect(report).toHaveBeenCalledOnce()
  })
})

describe('the saved First Site report', () => {
  const covers = (page: string) => page.startsWith('https://example.com/docs/')
  const row = (path: string, fields: Record<string, unknown> = {}) => ({ ...evidence, url: `https://example.com/docs/${path}`, ...fields })

  it('keeps gscdump order and only in-scope rows with Google evidence, up to the limit', async () => {
    const read = vi.fn(async () => ({
      urls: [row('a'), row('b', { coverageState: null, verdict: null }), row('c', { url: 'https://example.com/other' }), row('d', { coverageState: 'Submitted and indexed', verdict: 'PASS' }), row('e'), row('f')],
      pagination: { hasMore: true },
    }))
    const result = await readSavedFirstReport(covers, 3, read)
    expect(result).toMatchObject({ _tag: 'Verdicts', rows: [{ url: 'https://example.com/docs/a', capturedAt: evidence.lastCheckedAt }, { url: 'https://example.com/docs/d', verdict: 'PASS' }, { url: 'https://example.com/docs/e' }] })
    expect(read).toHaveBeenCalledOnce()
  })

  it('reports no saved verdict only when gscdump has no more rows', async () => {
    expect(await readSavedFirstReport(covers, 5, async () => ({ urls: [], pagination: { hasMore: false } }))).toEqual({ _tag: 'None' })
    expect(await readSavedFirstReport(covers, 5, async () => ({ urls: [row('a', { coverageState: null, verdict: null })], pagination: { hasMore: true } }))).toEqual({ _tag: 'Unknown' })
  })
})
