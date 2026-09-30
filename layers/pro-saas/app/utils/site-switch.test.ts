import { describe, expect, it } from 'vitest'
import { buildSiteSwitchPath, siteSwitchIdentity } from './site-switch'

function route(fullPath: string) {
  const path = fullPath.split(/[?#]/)[0]!
  return { path, fullPath }
}

describe('buildSiteSwitchPath', () => {
  it('keeps the page, query and hash when it swaps the Site', () => {
    expect(buildSiteSwitchPath(route('/pro/dashboard/sites/s_a/search-console/queries?period=28d#top'), 's_a', 's_b'))
      .toBe('/pro/dashboard/sites/s_b/search-console/queries?period=28d#top')
  })

  it('keeps a drill-in path segment', () => {
    expect(buildSiteSwitchPath(route('/pro/dashboard/sites/s_a/search-console/pages/https%3A%2F%2Fa.com%2Fblog'), 's_a', 's_b'))
      .toBe('/pro/dashboard/sites/s_b/search-console/pages/https%3A%2F%2Fa.com%2Fblog')
  })

  it('swaps the Site root for the other Site root', () => {
    expect(buildSiteSwitchPath(route('/pro/dashboard/sites/s_a'), 's_a', 's_b'))
      .toBe('/pro/dashboard/sites/s_b')
  })

  it('lands on the Site root when the route is not under the current Site', () => {
    expect(buildSiteSwitchPath(route('/pro/dashboard/sites/s_ab/indexing'), 's_a', 's_b'))
      .toBe('/pro/dashboard/sites/s_b')
    expect(buildSiteSwitchPath(route('/pro/dashboard/developers'), 's_a', 's_b'))
      .toBe('/pro/dashboard/sites/s_b')
  })
})

describe('siteSwitchIdentity', () => {
  it('prefers the Site name and takes the favicon host from the URL', () => {
    expect(siteSwitchIdentity({ publicId: 's_a', name: 'Docs', url: 'https://docs.example.com/' }))
      .toEqual({ ref: 's_a', label: 'Docs', domain: 'docs.example.com' })
  })

  it('names a fleet row by its domain and routes by its public id', () => {
    expect(siteSwitchIdentity({ siteId: 's_b', domain: 'example.com', property: 'sc-domain:example.com' }))
      .toEqual({ ref: 's_b', label: 'example.com', domain: 'example.com' })
  })

  it('falls back to a generic label when the Site has no name or host', () => {
    expect(siteSwitchIdentity({ publicId: 's_c' }))
      .toEqual({ ref: 's_c', label: 'Site', domain: '' })
  })
})
