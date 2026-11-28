import type { PropertyPickerInput } from './property-picker'
import { describe, expect, it } from 'vitest'
import { connectedSiteDomain } from '#layers/pro-saas/shared/site-url'
import { filterPickerProperties, projectPropertyPicker, propertyKindLabel, propertyPickerBlocksConnect } from './property-picker'

function loaded(data: PropertyPickerInput['data'], connectedDomains: string[] = []): PropertyPickerInput {
  return { queryStatus: 'success', data, sitesLoaded: true, connectedDomains: new Set(connectedDomains) }
}

describe('projectPropertyPicker', () => {
  // The 2026-10-01 replay: a Google account with no property saw a bare
  // address box and no word about why the list was missing.
  it('says the Google account has no property, and blocks connecting', () => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [] }))

    expect(state).toEqual({ _tag: 'NoProperties' })
    expect(propertyPickerBlocksConnect(state)).toBe(true)
  })

  it('asks for Google when the account has no gscdump connection', () => {
    expect(projectPropertyPicker(loaded({ connected: false, properties: [] }))).toEqual({ _tag: 'NotConnected' })
  })

  it('lists one row per host, the verified Domain property first', () => {
    const state = projectPropertyPicker(loaded({
      connected: true,
      properties: [
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:draft.dev', permissionLevel: 'siteUnverifiedUser' },
      ],
    }))

    expect(state).toEqual({
      _tag: 'Properties',
      properties: [
        { siteUrl: 'sc-domain:example.com', domain: 'example.com', verified: true },
        { siteUrl: 'sc-domain:draft.dev', domain: 'draft.dev', verified: false },
      ],
    })
    expect(propertyPickerBlocksConnect(state)).toBe(false)
  })

  it('blocks connecting when every listed property is unverified', () => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [{ siteUrl: 'sc-domain:draft.dev', permissionLevel: 'siteUnverifiedUser' }] }))

    expect(propertyPickerBlocksConnect(state)).toBe(true)
  })

  it('leaves out a property the Team already connected', () => {
    const state = projectPropertyPicker(loaded(
      { connected: true, properties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] },
      ['example.com'],
    ))

    expect(state).toEqual({ _tag: 'AllConnected' })
  })

  it('leaves out an imported URL-prefix Site without hiding its distinct www host', () => {
    const domain = connectedSiteDomain({ domain: null, property: 'https://example.com/' })!
    expect(projectPropertyPicker(loaded({
      connected: true,
      properties: [
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://www.example.com/', permissionLevel: 'siteOwner' },
      ],
    }, [domain]))).toEqual({
      _tag: 'Properties',
      properties: [{ siteUrl: 'https://www.example.com/', domain: 'www.example.com', verified: true }],
    })
  })

  it('uses the saved registered host of an imported Domain property', () => {
    const domain = connectedSiteDomain({ domain: null, property: 'sc-domain:example.com', gscdumpSiteUrl: 'www.example.com' })!
    expect(projectPropertyPicker(loaded({
      connected: true,
      properties: [
        { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
        { siteUrl: 'https://www.example.com/', permissionLevel: 'siteOwner' },
      ],
    }, [domain]))).toEqual({
      _tag: 'Properties',
      properties: [{ siteUrl: 'sc-domain:example.com', domain: 'example.com', verified: true }],
    })
  })

  it.each([
    ['AUTH_EXPIRED', 'Reconnect'],
    ['GSCDUMP_NOT_CONNECTED', 'Reconnect'],
    ['USER_PROVISIONING', 'Provisioning'],
    ['GSCDUMP_ERROR', 'Failed'],
  ] as const)('reads the %s answer as %s with its message', (reason, tag) => {
    const state = projectPropertyPicker(loaded({ connected: true, properties: [], error: { reason, message: 'Server words.' } }))

    expect(state).toEqual({ _tag: tag, message: 'Server words.' })
  })

  it('reads a failed request as a failed read, never as no properties', () => {
    expect(projectPropertyPicker({ queryStatus: 'error', data: null, sitesLoaded: true, connectedDomains: new Set() })._tag).toBe('Failed')
  })

  it('blocks nothing while the list loads', () => {
    const state = projectPropertyPicker({ queryStatus: 'pending', data: null, sitesLoaded: true, connectedDomains: new Set() })

    expect(state).toEqual({ _tag: 'Loading' })
    expect(propertyPickerBlocksConnect(state)).toBe(false)
  })

  it('blocks nothing while gscdump is still provisioning the account', () => {
    const state = projectPropertyPicker(loaded({
      connected: true,
      properties: [],
      error: { reason: 'USER_PROVISIONING', message: 'Preparing your Search Console workspace.' },
    }))

    expect(state).toEqual({ _tag: 'Provisioning', message: 'Preparing your Search Console workspace.' })
    expect(propertyPickerBlocksConnect(state)).toBe(false)
  })

  // The 2026-10-01 replay: the realtime resync re-read the list about 3 s
  // after load, and the picker went back to "Reading your Search Console
  // properties." until the second read landed, 10 to 13 s in all.
  it('keeps the last answer on screen while a re-read runs', () => {
    const state = projectPropertyPicker({ ...loaded({ connected: true, properties: [] }), queryStatus: 'pending' })

    expect(state).toEqual({ _tag: 'NoProperties' })
  })

  it('stays loading until the Team\'s Sites answer, so a connected property never shows as connectable', () => {
    const state = projectPropertyPicker({
      ...loaded({ connected: true, properties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] }),
      sitesLoaded: false,
    })

    expect(state).toEqual({ _tag: 'Loading' })
  })
})

describe('propertyKindLabel', () => {
  it.each([
    ['sc-domain:example.com', 'Domain'],
    ['https://example.com/', 'URL prefix'],
    ['http://sub.example.com/blog/', 'URL prefix'],
  ] as const)('labels %s as %s', (siteUrl, label) => {
    expect(propertyKindLabel(siteUrl)).toBe(label)
  })
})

describe('filterPickerProperties', () => {
  const properties = [
    { siteUrl: 'sc-domain:alorair.com', domain: 'alorair.com', verified: true },
    { siteUrl: 'https://shop.alorair.com/', domain: 'shop.alorair.com', verified: true },
    { siteUrl: 'sc-domain:northwind.co', domain: 'northwind.co', verified: false },
  ]

  it('returns all properties when the query is blank', () => {
    expect(filterPickerProperties(properties, '   ')).toEqual(properties)
  })

  it('matches by domain, raw property URL, or type label case-insensitively', () => {
    expect(filterPickerProperties(properties, 'NORTHWIND').map(p => p.domain)).toEqual(['northwind.co'])
    expect(filterPickerProperties(properties, 'url prefix').map(p => p.domain)).toEqual(['shop.alorair.com'])
    expect(filterPickerProperties(properties, 'sc-domain:alorair').map(p => p.domain)).toEqual(['alorair.com'])
    expect(filterPickerProperties(properties, 'no-such-domain')).toEqual([])
  })
})
