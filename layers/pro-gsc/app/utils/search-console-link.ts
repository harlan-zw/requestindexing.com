import type { LocationQuery } from 'vue-router'
import { withQuery } from 'ufo'

const analyticsKeys = ['period', 'compare', 'searchType', 'country', 'device', 'googleBrand', 'brand', 'questions', 'columns', 'counts'] as const

export function searchConsoleLink(path: string, query: LocationQuery = {}): string {
  return withQuery(path, Object.fromEntries(analyticsKeys
    .filter(key => query[key] !== undefined)
    .map(key => [key, query[key]])))
}
