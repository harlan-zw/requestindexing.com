import { describe, expect, it } from 'vitest'
import {
  isFirstPageIndexingUrlsRouteQuery,
  parseIndexingUrlsPage,
  parseIndexingUrlsRouteQuery,
} from './indexing-urls-first-page'

describe('parseIndexingUrlsPage', () => {
  it.each([
    ['2', 2],
    ['40', 40],
  ])('reads ?page=%s as page %i', (value, page) => {
    expect(parseIndexingUrlsPage(value)).toBe(page)
  })

  it.each([
    ['missing', undefined],
    ['zero', '0'],
    ['negative', '-3'],
    ['leading zero', '02'],
    ['decimal', '1.5'],
    ['words', 'two'],
    ['repeated', ['2', '3']],
    ['beyond a safe integer', '99999999999999999999'],
  ])('falls back to page 1 when the value is %s', (_label, value) => {
    expect(parseIndexingUrlsPage(value)).toBe(1)
  })
})

describe('parseIndexingUrlsRouteQuery', () => {
  it('reads every table filter from a shared link', () => {
    expect(parseIndexingUrlsRouteQuery({
      issue: 'crawled_not_indexed',
      search: '/blog',
      facet: 'rich_results',
      status: 'pending',
      page: '3',
    })).toEqual({
      issue: 'crawled_not_indexed',
      search: '/blog',
      facet: 'rich_results',
      status: 'pending',
      page: 3,
    })
  })

  it('drops values gscdump would not accept instead of forwarding them', () => {
    expect(parseIndexingUrlsRouteQuery({
      issue: 'not_a_real_issue',
      facet: 'sitemaps',
      status: 'excluded',
      search: '',
    })).toEqual({
      issue: undefined,
      search: undefined,
      facet: undefined,
      status: undefined,
      page: 1,
    })
  })

  it('ignores an inherited object key posing as an issue type', () => {
    expect(parseIndexingUrlsRouteQuery({ issue: 'toString' }).issue).toBeUndefined()
  })
})

describe('isFirstPageIndexingUrlsRouteQuery', () => {
  it('accepts a route with no table filters', () => {
    expect(isFirstPageIndexingUrlsRouteQuery({ utm_source: 'mail' })).toBe(true)
  })

  it.each(['issue', 'search', 'status', 'page', 'facet'])('rejects a route that carries ?%s=', (key) => {
    expect(isFirstPageIndexingUrlsRouteQuery({ [key]: 'x' })).toBe(false)
  })
})

it('keeps an exact lifecycle group in a shared link', () => {
  expect(parseIndexingUrlsRouteQuery({ cohort: 'lifecycle:versioned', page: '2' })).toMatchObject({
    cohort: { dimension: 'lifecycle', key: 'versioned' },
    status: 'not_indexed',
    page: 2,
  })
  expect(isFirstPageIndexingUrlsRouteQuery({ cohort: 'lifecycle:versioned' })).toBe(false)
})

it.each(['lifecycle:unknown', 'section:/docs/a/b', 'versioned', ['lifecycle:versioned']])('rejects invalid group selection %j', (cohort) => {
  expect(parseIndexingUrlsRouteQuery({ cohort }).cohort).toBeUndefined()
})

it.each([['status', 'indexed'], ['issue', 'crawled_not_indexed'], ['facet', 'rich_results']])('lets explicit %s replace the group', (key, value) => {
  expect(parseIndexingUrlsRouteQuery({ cohort: 'lifecycle:versioned', [key]: value }).cohort).toBeUndefined()
})
