import { describe, expect, it, vi } from 'vitest'
import { readIndexingCohortUrls } from './indexing-cohort-urls'

const row = (url: string, verdict = 'NEUTRAL') => ({ url, verdict, sitemaps: null })
const cohort = { dimension: 'lifecycle' as const, key: 'versioned' as const }

describe('readIndexingCohortUrls', () => {
  it('filters the complete snapshot before paginating the exact group', async () => {
    const first = Array.from({ length: 500 }, (_, i) => row(`/current/${i}`))
    const matches = [row('/docs/a/v5/one'), row('/guides/v3/two')]
    const read = vi.fn(async ({ offset }: { offset: number }) => ({
      urls: offset === 0 ? first : [...matches, row('/docs/a/v5/indexed', 'PASS')],
      pagination: { total: 503, hasMore: offset === 0 },
    }))
    const result = await readIndexingCohortUrls(read, { cohort, limit: 1, offset: 1 }, 'example.com')
    expect(result).toMatchObject({
      _tag: 'complete',
      data: { urls: [matches[1]], pagination: { total: 2, offset: 1, limit: 1, hasMore: false } },
    })
    expect(read.mock.calls.map(([page]) => page.offset)).toEqual([0, 500])
  })

  it('refuses an incomplete snapshot instead of showing a partial group', async () => {
    const read = vi.fn(async () => ({
      urls: Array.from({ length: 500 }, (_, i) => row(`/docs/v5/${i}`)),
      pagination: { total: 2001, hasMore: true },
    }))
    const result = await readIndexingCohortUrls(read, { cohort, limit: 25, offset: 0 }, 'example.com')
    expect(result).toEqual({ _tag: 'truncated', loaded: 2000, total: 2001 })
    expect(read).toHaveBeenCalledTimes(4)
  })
})
