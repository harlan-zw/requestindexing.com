import type { BuilderState } from 'gscdump/query'
import type { GoogleSearchSlice } from './google-search-slice'
import { resolveToBody } from 'gscdump/query'
import { expect, it, vi } from 'vitest'
import { readGoogleEntitySeries } from './google-dashboard-rows'

const slice: GoogleSearchSlice = { searchType: 'web', googleBrand: '', countries: ['usa', 'gbr'], devices: ['MOBILE'] }
const range = { start: '2026-10-20', end: '2026-10-21' }

it('reads a selected country series through the real live query resolver', async () => {
  const read = vi.fn(async (body) => {
    const request = resolveToBody(body as BuilderState)
    return [{ country: request.dimensionFilterGroups?.[0]?.filters?.find(filter => filter.dimension === 'country')?.expression, date: range.start, clicks: 4 }]
  })
  const rows = await readGoogleEntitySeries(read, slice, { range, dimension: 'country', keys: ['usa'], filters: [] })
  expect(rows.map(row => [row.country, row.clicks])).toEqual([['usa', 4]])
})

it('does not read a country outside the selected slice', async () => {
  const read = vi.fn(async () => [{ country: 'fra', date: range.start, clicks: 4 }])
  const rows = await readGoogleEntitySeries(read, slice, { range, dimension: 'country', keys: ['fra'], filters: [] })
  expect(rows).toEqual([])
  expect(read).not.toHaveBeenCalled()
})
