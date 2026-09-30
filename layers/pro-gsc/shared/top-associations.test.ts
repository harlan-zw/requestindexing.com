import { describe, expect, it } from 'vitest'
import { selectTopAssociations } from './top-associations'

const options = { groupField: 'queryCanonical', topField: 'page' }

describe('selectTopAssociations', () => {
  it('keeps the highest-clicking counterpart for each key', () => {
    const result = selectTopAssociations([
      { queryCanonical: 'nuxt seo', page: 'https://example.com/docs', clicks: 4 },
      { queryCanonical: 'nuxt seo', page: 'https://example.com/blog', clicks: 19 },
      { queryCanonical: 'sitemap', page: 'https://example.com/sitemap', clicks: 7 },
    ], options)

    expect([...result]).toEqual([
      ['nuxt seo', 'https://example.com/blog'],
      ['sitemap', 'https://example.com/sitemap'],
    ])
  })

  it('breaks a tie on the order the engine ranked the rows in', () => {
    const result = selectTopAssociations([
      { queryCanonical: 'nuxt seo', page: 'https://example.com/first', clicks: 3 },
      { queryCanonical: 'nuxt seo', page: 'https://example.com/second', clicks: 3 },
    ], options)

    expect(result.get('nuxt seo')).toBe('https://example.com/first')
  })

  it('ranks a zero-click row rather than dropping the key', () => {
    const result = selectTopAssociations([
      { queryCanonical: 'quiet term', page: 'https://example.com/quiet', clicks: 0 },
    ], options)

    expect(result.get('quiet term')).toBe('https://example.com/quiet')
  })

  it('skips rows with no counterpart and rows with no key', () => {
    const result = selectTopAssociations([
      { queryCanonical: 'nuxt seo', page: '', clicks: 10 },
      { queryCanonical: '', page: 'https://example.com/orphan', clicks: 10 },
      { page: 'https://example.com/keyless', clicks: 10 },
    ], options)

    expect(result.size).toBe(0)
  })

  // The hosted report writes the top raw variant over `queryCanonical`. The
  // table asks by clustering key, so the answer must come back under it.
  it('keys a relabelled canonical query by its clustering key', () => {
    const result = selectTopAssociations([
      { queryCanonical: 'cotton tree caravan park', queryCanonicalKey: 'caravan cotton park tree', page: 'https://example.com/park', clicks: 12 },
    ], options)

    expect(result.get('caravan cotton park tree')).toBe('https://example.com/park')
  })

  it('reads the top keyword for a page table by swapping the fields', () => {
    const result = selectTopAssociations([
      { page: 'https://example.com/a', query: 'one', clicks: 2 },
      { page: 'https://example.com/a', query: 'two', clicks: 8 },
    ], { groupField: 'page', topField: 'query' })

    expect(result.get('https://example.com/a')).toBe('two')
  })
})
