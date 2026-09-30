import type { BingSiteV1 } from '@gscdump/contracts/v1/http'
import { bingLinkResultV1Schemas, bingSitemapSubmitResultV1Schemas, bingSitesV1Schemas } from '@gscdump/contracts/v1/http'
import { describe, expect, it } from 'vitest'
import {
  bingGrantTarget,
  bingIntegrationStatusLine,
  bingLinkOutcomeMessage,
  bingSitemapLabel,
  bingSitemapSubmitMessage,
  parseBingAuthorizationReturn,
  summarizeBingIntegration,
  toBingIntegrationRows,
} from './bing-integration-view'

// Every fixture goes through the 4.8.0 client schemas, so a test can never
// feed the view a state gscdump cannot send.
const cname = { _tag: 'cname', name: 'abc123', value: 'verify.bing.com' }

function fleetSite(siteId: string, state: unknown, callerCanAct = true) {
  return { siteId, siteUrl: `https://${siteId}.example.com/`, teamId: null, callerCanAct, state }
}

function fleet(sites: unknown[], grant: unknown = { _tag: 'authorized', scopes: ['webmaster.manage'] }) {
  return bingSitesV1Schemas.client.parse({ searchEngine: 'bing', grant, sites })
}

function site(id: string, gscdumpSiteId: string | null = `s_${id}`) {
  return { siteId: id, gscdumpSiteId, domain: `${id}.example.com`, property: `https://${id}.example.com/` }
}

function collecting(sitemap: unknown) {
  return {
    _tag: 'collecting',
    remoteSiteUrl: 'https://a.example.com/',
    lastEvidenceAt: '2026-09-30T08:00:00.000Z',
    sitemap,
  }
}
const missingSitemap = { _tag: 'missing', checkedAt: '2026-09-30T08:00:00.000Z', lastSubmittedAt: null }

describe('toBingIntegrationRows', () => {
  it('joins gscdump state to the dashboard Sites by engine id, never by route id', () => {
    const rows = toBingIntegrationRows(
      [site('a'), site('b')],
      fleet([fleetSite('s_b', { _tag: 'linkable', reason: 'not-linked' }), fleetSite('s_a', collecting(missingSitemap))]),
      true,
    )
    expect(rows.map(row => [row.site.siteId, row._tag])).toEqual([['a', 'collecting'], ['b', 'linkable']])
  })

  // The dashboard list is the denominator: a Site the caller cannot see here
  // must not count toward coverage.
  it('leaves out a Site gscdump reports that the dashboard does not list', () => {
    const rows = toBingIntegrationRows([site('a')], fleet([
      fleetSite('s_a', { _tag: 'linkable', reason: 'not-linked' }),
      fleetSite('s_other', { _tag: 'linkable', reason: 'not-linked' }),
    ]), true)
    expect(rows).toHaveLength(1)
  })

  it('marks a Site Search Console has not linked yet as waiting on Search Console', () => {
    const rows = toBingIntegrationRows([site('a', null)], fleet([]), true)
    expect(rows).toEqual([{ _tag: 'unavailable', site: site('a', null), reason: 'needs-search-console' }])
  })

  it.each([
    [{ _tag: 'verification-required', remoteSiteUrl: 'https://a.example.com/', verification: cname }, 'verify'],
    [{ _tag: 'reauthorization-required', remoteSiteUrl: 'https://a.example.com/' }, 'reconnect'],
    [{ _tag: 'linkable', reason: 'binding-stalled' }, 'linkable'],
    [{ _tag: 'grant-required', reason: 'grant-missing' }, 'grant-required'],
    [{ _tag: 'unavailable', reason: 'not-enabled' }, 'unavailable'],
  ])('maps the gscdump state %j to one %s row', (state, tag) => {
    const [row] = toBingIntegrationRows([site('a')], fleet([fleetSite('s_a', state)]), true)
    expect(row?._tag).toBe(tag)
  })

  // gscdump lets only the Site owner link or authorize. A Team viewer here
  // cannot act either, whatever gscdump says.
  it('lets the caller act only when gscdump allows it and the Team role can write', () => {
    const state = { _tag: 'linkable', reason: 'not-linked' }
    const canAct = (callerCanAct: boolean, canWrite: boolean) =>
      toBingIntegrationRows([site('a')], fleet([fleetSite('s_a', state, callerCanAct)]), canWrite)[0]
    expect(canAct(true, true)).toMatchObject({ canAct: true })
    expect(canAct(false, true)).toMatchObject({ canAct: false })
    expect(canAct(true, false)).toMatchObject({ canAct: false })
  })
})

describe('summarizeBingIntegration', () => {
  it('counts linked Sites out of the Sites that can hold a link', () => {
    const rows = toBingIntegrationRows([site('a'), site('b'), site('c'), site('d', null), site('e')], fleet([
      fleetSite('s_a', collecting(missingSitemap)),
      fleetSite('s_b', { _tag: 'verification-required', remoteSiteUrl: 'https://b.example.com/', verification: cname }),
      fleetSite('s_c', { _tag: 'linkable', reason: 'not-linked' }),
      fleetSite('s_e', { _tag: 'unavailable', reason: 'not-enabled' }),
    ]), true)
    expect(summarizeBingIntegration(rows)).toEqual({
      linked: 2,
      eligible: 3,
      linkable: 1,
      sitemapsMissing: 1,
      notEnabled: 1,
      pending: null,
    })
  })

  it('owes a reconnect when Microsoft stopped accepting the grant for any Site', () => {
    const rows = toBingIntegrationRows([site('a'), site('b')], fleet([
      fleetSite('s_a', collecting(missingSitemap)),
      fleetSite('s_b', { _tag: 'grant-required', reason: 'reauthorization-required' }),
    ]), true)
    expect(summarizeBingIntegration(rows).pending).toBe('reconnect')
  })

  // Once one Site is linked, leaving the rest unlinked is a choice. A chip
  // that never clears is noise.
  it('owes a connect only while no Site is linked', () => {
    const unlinked = toBingIntegrationRows([site('a')], fleet([fleetSite('s_a', { _tag: 'grant-required', reason: 'grant-missing' })]), true)
    expect(summarizeBingIntegration(unlinked).pending).toBe('connect')
    const oneLinked = toBingIntegrationRows([site('a'), site('b')], fleet([
      fleetSite('s_a', collecting(missingSitemap)),
      fleetSite('s_b', { _tag: 'grant-required', reason: 'grant-missing' }),
    ]), true)
    expect(summarizeBingIntegration(oneLinked).pending).toBeNull()
  })

  it('counts only the links and submits the caller can run', () => {
    const rows = toBingIntegrationRows([site('a'), site('b')], fleet([
      fleetSite('s_a', collecting(missingSitemap), false),
      fleetSite('s_b', { _tag: 'linkable', reason: 'not-linked' }, false),
    ]), true)
    expect(summarizeBingIntegration(rows)).toMatchObject({ linkable: 0, sitemapsMissing: 0 })
  })
})

describe('bingGrantTarget', () => {
  it('picks a reconnect before a first connect', () => {
    const rows = toBingIntegrationRows([site('a'), site('b')], fleet([
      fleetSite('s_a', { _tag: 'grant-required', reason: 'grant-missing' }),
      fleetSite('s_b', { _tag: 'reauthorization-required', remoteSiteUrl: 'https://b.example.com/' }),
    ]), true)
    expect(bingGrantTarget(rows)).toEqual({ site: site('b'), reason: 'reauthorization-required' })
  })

  it('offers no round trip for a Site the caller cannot authorize', () => {
    const rows = toBingIntegrationRows([site('a')], fleet([
      fleetSite('s_a', { _tag: 'grant-required', reason: 'grant-missing' }, false),
    ]), true)
    expect(bingGrantTarget(rows)).toBeNull()
  })
})

describe('bingIntegrationStatusLine', () => {
  const summary = { linked: 2, eligible: 3, linkable: 1, sitemapsMissing: 0, notEnabled: 0, pending: null } as const

  it('states coverage as Sites linked out of Sites that can link', () => {
    expect(bingIntegrationStatusLine({ _tag: 'ready', summary })).toBe('2 of 3 Sites linked')
    expect(bingIntegrationStatusLine({ _tag: 'ready', summary: { ...summary, linked: 0, eligible: 1 } })).toBe('0 of 1 Site linked')
  })

  it('leads with the reconnect when Bing stopped accepting the grant', () => {
    expect(bingIntegrationStatusLine({ _tag: 'ready', summary: { ...summary, pending: 'reconnect' } }))
      .toBe('Reconnect needed. Bing stopped accepting the connection.')
  })

  it('names why no Site can link', () => {
    expect(bingIntegrationStatusLine({ _tag: 'ready', summary: { ...summary, linked: 0, eligible: 0 } }))
      .toBe('Waiting for Search Console to link a Site')
    expect(bingIntegrationStatusLine({ _tag: 'ready', summary: { ...summary, linked: 0, eligible: 0, notEnabled: 2 } }))
      .toBe('Not available for your account yet')
    expect(bingIntegrationStatusLine({ _tag: 'not-offered' })).toBe('Not available for your account yet')
  })

  it('says the Integration is not available yet while the flag is off', () => {
    expect(bingIntegrationStatusLine({ _tag: 'unavailable' })).toBe('Not available yet')
  })
})

describe('bingLinkOutcomeMessage', () => {
  const linkedSite = (state: unknown): BingSiteV1 => fleetSite('s_a', state) as BingSiteV1

  it('confirms a link that starts collection', () => {
    const result = bingLinkResultV1Schemas.client.parse({ _tag: 'linked', site: linkedSite(collecting({ _tag: 'unknown' })) })
    expect(bingLinkOutcomeMessage(result, 'a.example.com'))
      .toEqual({ tone: 'success', text: 'a.example.com linked. Bing data collection starts within a day.' })
  })

  it('asks for the DNS record when the link still needs verification', () => {
    const result = bingLinkResultV1Schemas.client.parse({
      _tag: 'linked',
      site: linkedSite({ _tag: 'verification-required', remoteSiteUrl: 'https://a.example.com/', verification: cname }),
    })
    expect(bingLinkOutcomeMessage(result, 'a.example.com'))
      .toEqual({ tone: 'warning', text: 'a.example.com linked. Add the Bing DNS record to start collection.' })
  })

  it('sends the caller to reconnect when Microsoft stopped accepting the grant', () => {
    const result = bingLinkResultV1Schemas.client.parse({ _tag: 'grant-required', reason: 'reauthorization-required' })
    expect(bingLinkOutcomeMessage(result, 'a.example.com').text).toBe('Bing stopped accepting the connection. Reconnect Bing, then link again.')
  })

  it('names the Bing refusal for a failed link', () => {
    const result = bingLinkResultV1Schemas.client.parse({ _tag: 'failed', reason: 'sites-throttled', retryable: true })
    expect(bingLinkOutcomeMessage(result, 'a.example.com'))
      .toEqual({ tone: 'error', text: 'Bing delayed the connection. Wait a few minutes, then retry.' })
  })
})

describe('bingSitemapLabel', () => {
  it.each([
    [missingSitemap, 'Not submitted'],
    [{ _tag: 'unknown' }, 'Not checked yet'],
    [{ _tag: 'awaiting-bing', checkedAt: null, lastSubmittedAt: '2026-09-30T08:00:00.000Z' }, 'Submitted · waiting for Bing'],
    [{ _tag: 'submitted', checkedAt: '2026-09-30T08:00:00.000Z', sitemapCount: 1, urlCount: 1204, lastCrawledAt: null, sitemaps: [{ url: 'https://a.example.com/sitemap.xml', status: 'Success', submittedAt: null, lastCrawledAt: null, urlCount: 1204 }] }, 'Submitted · 1,204 URLs'],
    [{ _tag: 'submitted', checkedAt: '2026-09-30T08:00:00.000Z', sitemapCount: 2, urlCount: null, lastCrawledAt: null, sitemaps: [{ url: 'https://a.example.com/a.xml', status: 'Success', submittedAt: null, lastCrawledAt: null, urlCount: null }, { url: 'https://a.example.com/b.xml', status: 'Success', submittedAt: null, lastCrawledAt: null, urlCount: null }] }, '2 sitemaps'],
  ])('labels %j as %s', (sitemap, label) => {
    const [row] = toBingIntegrationRows([site('a')], fleet([fleetSite('s_a', collecting(sitemap))]), true)
    expect(row?._tag === 'collecting' && bingSitemapLabel(row.sitemap)).toBe(label)
  })
})

describe('bingSitemapSubmitMessage', () => {
  it('says Bing lags when it accepted the sitemap but does not list it yet', () => {
    const result = bingSitemapSubmitResultV1Schemas.client.parse({
      _tag: 'submitted',
      sitemapUrl: 'https://a.example.com/sitemap.xml',
      sitemap: { _tag: 'awaiting-bing', checkedAt: null, lastSubmittedAt: '2026-09-30T08:00:00.000Z' },
    })
    expect(bingSitemapSubmitMessage(result, 'a.example.com'))
      .toEqual({ tone: 'warning', text: 'Bing accepted the sitemap for a.example.com but does not list it yet. Check again tomorrow.' })
  })

  it('names the missing sitemap and where to look', () => {
    const result = bingSitemapSubmitResultV1Schemas.client.parse({ _tag: 'failed', reason: 'no-sitemap-found', retryable: false })
    expect(bingSitemapSubmitMessage(result, 'a.example.com').text)
      .toBe('No sitemap found for a.example.com. Check robots.txt and /sitemap.xml, then submit again.')
  })

  it('keeps a request that got no answer apart from a Bing refusal', () => {
    expect(bingSitemapSubmitMessage({ _tag: 'unreachable' }, 'a.example.com'))
      .toEqual({ tone: 'error', text: 'The submit for a.example.com did not get an answer. Submit again shortly.' })
  })
})

describe('parseBingAuthorizationReturn', () => {
  it('reads no outcome when gscdump did not send the browser back', () => {
    expect(parseBingAuthorizationReturn({})).toEqual({ _tag: 'none' })
  })

  it.each(['connected', 'verification-required'] as const)('reads %s as a finished authorization', (outcome) => {
    expect(parseBingAuthorizationReturn({ bing: outcome })).toEqual({ _tag: outcome })
  })

  it('turns an error reason into the sentence the reader sees', () => {
    expect(parseBingAuthorizationReturn({ bing: 'error', reason: 'access-denied' }))
      .toEqual({ _tag: 'error', message: 'Bing access was denied. Retry when you are ready.' })
    expect(parseBingAuthorizationReturn({ bing: 'error', reason: ['x', 'y'] }))
      .toEqual({ _tag: 'error', message: 'Bing could not complete OAuth. Retry the connection.' })
  })

  it('ignores an outcome gscdump never sends', () => {
    expect(parseBingAuthorizationReturn({ bing: 'maybe' })).toEqual({ _tag: 'none' })
  })
})
