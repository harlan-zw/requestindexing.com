import { expect, it } from 'vitest'
import { searchConsoleLink } from './search-console-link'

it('carries analytics selections without carrying table search or pagination', () => {
  const path = '/pro/dashboard/sites/s_app/search-console/queries/Cr%C3%A8me%20%2B%20Shoes'
  const link = new URL(searchConsoleLink(path, {
    country: 'usa,gbr',
    device: 'MOBILE,TABLET',
    searchType: 'web',
    googleBrand: 'BRANDED',
    period: '7d',
    compare: 'none',
    columns: 'clicks',
    counts: 'pages',
    brand: '',
    questions: '',
    q: 'shoes',
    page: '2',
    sort: 'clicks',
  }), 'https://requestindexing.com')
  expect(link.pathname).toBe(path)
  expect(Object.fromEntries(link.searchParams)).toEqual({
    country: 'usa,gbr',
    device: 'MOBILE,TABLET',
    searchType: 'web',
    googleBrand: 'BRANDED',
    period: '7d',
    compare: 'none',
    columns: 'clicks',
    counts: 'pages',
    brand: '',
    questions: '',
  })
})
