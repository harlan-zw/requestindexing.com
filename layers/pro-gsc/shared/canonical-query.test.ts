import { describe, expect, it } from 'vitest'
import { canonicalQueryKey, dimensionKey } from './canonical-query'

// The hosted report names each group by its top raw variant and keeps the
// clustering key beside it. The rows read returns the key alone.
const reportRow = { queryCanonical: 'cotton tree caravan park', queryCanonicalKey: 'caravan cotton park tree', clicks: 40 }
const rowsReadRow = { queryCanonical: 'caravan cotton park tree', date: '2026-09-01', clicks: 3 }

describe('canonicalQueryKey', () => {
  it('reads the clustering key from a report row the engine relabelled', () => {
    expect(canonicalQueryKey(reportRow)).toBe('caravan cotton park tree')
  })

  it('reads the key from a rows read, which carries no label', () => {
    expect(canonicalQueryKey(rowsReadRow)).toBe('caravan cotton park tree')
  })

  it('returns an empty key for a row with no canonical query', () => {
    const rawQueryRow: Record<string, unknown> = { query: 'nuxt seo' }
    expect(canonicalQueryKey(rawQueryRow)).toBe('')
  })

  it('ignores a key field that is not a string', () => {
    expect(canonicalQueryKey({ queryCanonical: 'nuxt seo', queryCanonicalKey: null })).toBe('nuxt seo')
  })
})

describe('dimensionKey', () => {
  it('gives a report row and a rows read of the same group one identity', () => {
    expect(dimensionKey(reportRow, 'queryCanonical')).toBe(dimensionKey(rowsReadRow, 'queryCanonical'))
  })

  it('reads any other dimension from its own field', () => {
    expect(dimensionKey({ page: 'https://example.com/', queryCanonicalKey: 'x' }, 'page')).toBe('https://example.com/')
  })
})
