import { describe, expect, it } from 'vitest'
import { readProFeatureFlags, requiredProFeatureFlag } from './manifest'

describe('requiredProFeatureFlag', () => {
  it('names the flag a declared Bing route needs', () => {
    expect(requiredProFeatureFlag('/pro/dashboard/sites/s_abc/search-console/bing')).toBe('bing')
    expect(requiredProFeatureFlag('/pro/dashboard/sites/s_abc/indexing/bing')).toBe('bing')
  })

  it('leaves an unflagged route open', () => {
    expect(requiredProFeatureFlag('/pro/dashboard/sites/s_abc/indexing/urls')).toBeNull()
    expect(requiredProFeatureFlag('/pro/dashboard')).toBeNull()
  })

  it('ignores a query string and a hash', () => {
    expect(requiredProFeatureFlag('/pro/dashboard/sites/s_abc/indexing/bing?bing=connected#top')).toBe('bing')
  })

  // A prefix match would close `/indexing/bing-something` too, and a suffix
  // match would leave `/evil/indexing/bing` open.
  it('matches the whole path, not a fragment of it', () => {
    expect(requiredProFeatureFlag('/pro/dashboard/sites/s_abc/indexing/bingo')).toBeNull()
    expect(requiredProFeatureFlag('/elsewhere/pro/dashboard/sites/s_abc/indexing/bing')).toBeNull()
  })

  it('accepts any Site id in the route parameter', () => {
    expect(requiredProFeatureFlag('/pro/dashboard/sites/42/search-console/bing')).toBe('bing')
  })
})

describe('readProFeatureFlags', () => {
  it('reads a boolean flag off the public runtime config', () => {
    expect(readProFeatureFlags({ features: { bing: true } })).toEqual({ bing: true })
  })

  // NUXT_PUBLIC_FEATURES_BING arrives as a string in some deployments, and
  // "false" is truthy.
  it('reads the string "true" as on and every other string as off', () => {
    expect(readProFeatureFlags({ features: { bing: 'true' } })).toEqual({ bing: true })
    expect(readProFeatureFlags({ features: { bing: 'false' } })).toEqual({ bing: false })
    expect(readProFeatureFlags({ features: { bing: '1' } })).toEqual({ bing: false })
  })

  it('reports every flag off when the config has no features block', () => {
    expect(readProFeatureFlags({})).toEqual({})
    expect(readProFeatureFlags(null)).toEqual({})
    expect(readProFeatureFlags(undefined)).toEqual({})
  })
})
