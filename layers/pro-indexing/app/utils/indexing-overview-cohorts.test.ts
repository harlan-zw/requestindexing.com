import { describe, expect, it, vi } from 'vitest'
import { loadIndexingOverviewCohorts } from './indexing-overview-cohorts'

const diagnostics = { issues: [{ type: 'not_indexed', count: 0 }] } as const
const firstPage = {
  urls: Array.from({ length: 329 }, (_, i) => ({ url: `https://example.com/docs/${i}`, verdict: 'PASS', sitemaps: null })),
  pagination: { total: 329, hasMore: false },
  meta: { siteUrl: 'https://example.com/' },
}

describe('loadIndexingOverviewCohorts', () => {
  it('uses a complete overview snapshot without reading the engine again', async () => {
    const read = vi.fn().mockRejectedValue(new Error('request aborted'))
    const result = await loadIndexingOverviewCohorts(firstPage, diagnostics, read)
    expect(result).toMatchObject({ _tag: 'uniform' })
    expect(read).not.toHaveBeenCalled()
  })

  it('waits for the overview URL read before starting another read', async () => {
    const read = vi.fn()
    expect(await loadIndexingOverviewCohorts(null, diagnostics, read)).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('waits for diagnostics before ranking a complete snapshot', async () => {
    const read = vi.fn()
    expect(await loadIndexingOverviewCohorts(firstPage, null, read)).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('reads all pages when the overview snapshot is partial', async () => {
    const response = { _tag: 'no-evidence', reason: 'no-inspection-join', crawlSettingsId: null, asOf: null, sample: null } as const
    const read = vi.fn().mockResolvedValue(response)
    expect(await loadIndexingOverviewCohorts({ ...firstPage, pagination: { total: 1500, hasMore: true } }, diagnostics, read)).toEqual(response)
    expect(read).toHaveBeenCalledOnce()
  })

  it('preserves the incomplete-evidence refusal from diagnostics', async () => {
    const read = vi.fn()
    expect(await loadIndexingOverviewCohorts(firstPage, { issues: [{ type: 'not_indexed', count: 300 }] }, read)).toMatchObject({ _tag: 'no-evidence', reason: 'sampled-index-state' })
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects a snapshot whose row count disagrees with its total', async () => {
    const failure = new Error('remaining pages unavailable')
    const read = vi.fn().mockRejectedValue(failure)
    await expect(loadIndexingOverviewCohorts({ ...firstPage, pagination: { total: 500, hasMore: false } }, diagnostics, read)).rejects.toBe(failure)
    expect(read).toHaveBeenCalledOnce()
  })
})
