import type { GscSearchType } from '@gscdump/contracts'
import type { AnalyticsRowsV1Request } from '@gscdump/contracts/v1/http'
import { searchTypeSupportsDimensions } from '@gscdump/contracts'
import { liveSearchPerformanceRequest } from '@gscdump/sdk/hosted-query'

type Device = 'DESKTOP' | 'MOBILE' | 'TABLET'
export type GoogleBrand = '' | 'BRANDED' | 'NON_BRANDED'

export interface GoogleSearchSlice {
  searchType: GscSearchType
  googleBrand: GoogleBrand
  countries: string[]
  devices: Device[]
}

type RowsFilter = NonNullable<AnalyticsRowsV1Request['filter']>['_filters'][number]

export function selectedFilterValues(value: string) {
  return [...new Set(value.split(',').filter(Boolean))].sort()
}

export function toggleFilterValue(current: string, value: string) {
  const values = selectedFilterValues(current)
  return (values.includes(value) ? values.filter(item => item !== value) : [...values, value].sort()).join(',')
}

function isDevice(value: string): value is Device {
  return value === 'DESKTOP' || value === 'MOBILE' || value === 'TABLET'
}

export function googleSearchSlice(input: {
  searchType: GscSearchType
  googleBrand: string
  country: string
  device: string
}): GoogleSearchSlice | null {
  const { searchType } = input
  const googleBrand = searchType === 'web' && (input.googleBrand === 'BRANDED' || input.googleBrand === 'NON_BRANDED')
    ? input.googleBrand
    : ''
  const hasDimensions = searchTypeSupportsDimensions(searchType)
  const countries = hasDimensions ? selectedFilterValues(input.country).filter(value => /^[a-z]{3}$/.test(value)) : []
  const devices = hasDimensions ? selectedFilterValues(input.device).filter(isDevice) : []
  if (!googleBrand && searchType !== 'webMultimodal' && !countries.length && !devices.length)
    return null
  return { searchType, googleBrand, countries, devices }
}

export function buildGoogleRowsRequest(
  slice: GoogleSearchSlice,
  input: {
    range: { start: string, end: string }
    dimensions: AnalyticsRowsV1Request['dimensions']
    limit?: number
    offset?: number
    split?: boolean
    filters?: RowsFilter[]
    orderBy?: AnalyticsRowsV1Request['orderBy']
  },
): AnalyticsRowsV1Request {
  const facets = { range: input.range, countries: slice.countries, devices: slice.devices }
  const request = liveSearchPerformanceRequest(slice.searchType === 'webMultimodal'
    ? { ...facets, searchType: 'webMultimodal', brand: 'all' }
    : { ...facets, searchType: 'web', brand: input.split ? 'split' : slice.googleBrand || 'all' })
  return {
    ...request,
    searchType: slice.searchType,
    dimensions: input.dimensions,
    metrics: ['clicks', 'impressions', 'ctr', 'position'],
    rowLimit: input.limit ?? 1000,
    startRow: input.offset,
    orderBy: input.orderBy,
    filter: {
      ...request.filter,
      _filters: [...(request.filter?._filters ?? []), ...(input.filters ?? [])],
    },
  }
}
