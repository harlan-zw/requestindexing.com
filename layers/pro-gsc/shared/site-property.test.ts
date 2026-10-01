import type { GscdumpAvailableSite } from '@gscdump/contracts'
import type { SearchConsolePropertyRead } from './site-property'
import { describe, expect, it } from 'vitest'
import { matchSiteProperty } from './site-property'

const EXAMPLE = { origin: 'https://example.com', domain: 'example.com' }

function owns(...properties: Array<[string, string?]>): SearchConsolePropertyRead {
  return {
    _tag: 'Loaded',
    properties: properties.map(([siteUrl, permissionLevel = 'siteOwner']): GscdumpAvailableSite => ({ siteUrl, permissionLevel, registered: false })),
  }
}

describe('matchSiteProperty', () => {
  it('prefers a verified Domain property over a URL-prefix one', () => {
    const match = matchSiteProperty(EXAMPLE, owns(['https://example.com/'], ['sc-domain:example.com']))

    expect(match).toMatchObject({ _tag: 'Matched', property: { siteUrl: 'sc-domain:example.com' } })
  })

  it('matches a www address to the bare property', () => {
    const match = matchSiteProperty({ origin: 'https://www.example.com', domain: 'www.example.com' }, owns(['https://example.com/']))

    expect(match._tag).toBe('Matched')
  })

  it('picks the verified property when an unverified one also covers the address', () => {
    const match = matchSiteProperty(EXAMPLE, owns(['sc-domain:example.com', 'siteUnverifiedUser'], ['https://example.com/']))

    expect(match).toMatchObject({ _tag: 'Matched', property: { siteUrl: 'https://example.com/' } })
  })

  it.each([
    ['no property at all', owns(), 'no_properties'],
    ['another site only', owns(['sc-domain:mysite.dev']), 'not_owned'],
    ['a parent of a different host', owns(['https://shop.example.com/']), 'not_owned'],
    ['an unverified property only', owns(['sc-domain:example.com', 'siteUnverifiedUser']), 'unverified'],
    ['no gscdump connection', { _tag: 'NotConnected' } as const, 'not_connected'],
    ['a failed read', { _tag: 'Unavailable', reason: 'timeout' } as const, 'unavailable'],
  ])('refuses example.com for %s', (_, read, reason) => {
    const match = matchSiteProperty(EXAMPLE, read)

    expect(match).toMatchObject({ _tag: 'Refused', refusal: { reason } })
  })

  it('names the address in the refusal', () => {
    const match = matchSiteProperty(EXAMPLE, owns(['sc-domain:mysite.dev']))

    expect(match._tag === 'Refused' && match.refusal.message).toContain('example.com')
  })
})
