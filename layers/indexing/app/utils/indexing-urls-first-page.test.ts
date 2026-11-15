import { describe, expect, it } from 'vitest'
import { isFirstPageIndexingUrlsRouteQuery } from './indexing-urls-first-page'

describe('isFirstPageIndexingUrlsRouteQuery', () => {
  it('accepts a route with no table filters', () => {
    expect(isFirstPageIndexingUrlsRouteQuery({ utm_source: 'mail' })).toBe(true)
  })

  it.each(['cohort', 'issue', 'search', 'status', 'page', 'facet'])('rejects a route that carries ?%s=', (key) => {
    expect(isFirstPageIndexingUrlsRouteQuery({ [key]: 'x' })).toBe(false)
  })
})
