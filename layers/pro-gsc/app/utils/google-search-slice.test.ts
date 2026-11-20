import { describe, expect, it } from 'vitest'
import { buildGoogleRowsRequest, googleSearchSlice } from './google-search-slice'

describe('google Search Console views', () => {
  it('sends one filter list per dimension and keeps native brand off the query-text dimension', () => {
    const slice = googleSearchSlice({
      searchType: 'web',
      googleBrand: 'BRANDED',
      country: 'usa,gbr,usa',
      device: 'MOBILE,DESKTOP',
    })!
    const request = buildGoogleRowsRequest(slice, {
      range: { start: '2026-08-19', end: '2026-11-16' },
      dimensions: ['query'],
      limit: 25,
    })
    expect(request).toMatchObject({
      source: 'live',
      dimensions: ['query'],
      rowLimit: 25,
      filter: {
        _filters: expect.arrayContaining([{ dimension: 'brandedClassification', operator: 'equals', expression: 'BRANDED' }]),
        _nestedGroups: [
          { _groupType: 'or', _filters: [{ dimension: 'country', operator: 'equals', expression: 'gbr' }, { dimension: 'country', operator: 'equals', expression: 'usa' }] },
          { _groupType: 'or', _filters: [{ dimension: 'device', operator: 'equals', expression: 'DESKTOP' }, { dimension: 'device', operator: 'equals', expression: 'MOBILE' }] },
        ],
      },
    })
  })

  it('uses ordinary data when the Google filter is cleared', () => {
    expect(googleSearchSlice({ searchType: 'web', googleBrand: '', country: '', device: '' })).toBeNull()
  })

  it('keeps a Web Multimodal slice free of a Web-only brand selection', () => {
    const slice = googleSearchSlice({
      searchType: 'webMultimodal',
      googleBrand: 'BRANDED',
      country: '',
      device: '',
    })!
    const request = buildGoogleRowsRequest(slice, {
      range: { start: '2026-08-19', end: '2026-11-16' },
      dimensions: ['page'],
    })
    expect(request.searchType).toBe('webMultimodal')
    expect(request.filter?._filters.map(filter => filter.dimension)).toEqual(['date'])
  })
})
