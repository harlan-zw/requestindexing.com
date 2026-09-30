import type { BingConnectionV1, BingDataV1 } from '@gscdump/contracts/v1/http'
import { describe, expect, it } from 'vitest'
import {
  bingConnectionSetupState,
  bingIntegrationStatusLine,
  bingRequestErrorState,
  bingTrafficTotals,
  formatBingCtr,
  projectBingIntegrationState,
  toBingConnectionView,
} from './bing-view'

type TrafficRows = Extract<BingDataV1, { dataset: 'traffic' }>['rows']

const connected = {
  _tag: 'connected',
  searchEngine: 'bing',
  remoteSiteUrl: 'https://example.com',
  verified: true,
  scopes: ['webmaster.read'],
  tokenExpiresAt: null,
  lastEvidenceAt: null,
} satisfies BingConnectionV1

describe('toBingConnectionView', () => {
  it('reads a connected Site as ready', () => {
    expect(toBingConnectionView(connected)).toEqual({ _tag: 'ready' })
  })

  it('carries the CNAME record through a verification-required state', () => {
    const view = toBingConnectionView({
      _tag: 'verification-required',
      searchEngine: 'bing',
      remoteSiteUrl: 'https://example.com',
      verified: false,
      verification: { _tag: 'cname', name: 'abc123.example.com', value: 'verify.bing.com' },
    })
    expect(view).toEqual({
      _tag: 'verification-required',
      remoteSiteUrl: 'https://example.com',
      verification: { _tag: 'cname', name: 'abc123.example.com', value: 'verify.bing.com' },
    })
  })

  // `unavailable` means Bing kept the grant but lost permission on the Site.
  // Both states need the same action, so they collapse to one view.
  it('reads a lost permission as reauth, like an expired authorization', () => {
    expect(toBingConnectionView({ ...connected, _tag: 'reauthorization-required' })).toEqual({ _tag: 'reauth' })
    expect(toBingConnectionView({ ...connected, _tag: 'unavailable', reason: 'permission-lost' })).toEqual({ _tag: 'reauth' })
  })
})

describe('bingConnectionSetupState', () => {
  it('asks for nothing once the connection is ready', () => {
    expect(bingConnectionSetupState({ _tag: 'ready' })).toBeNull()
  })

  it.each([
    ['disconnected' as const, 'search'],
    ['reauth' as const, 'warning'],
  ])('describes the %s state with the %s icon', (tag, icon) => {
    const state = bingConnectionSetupState({ _tag: tag })
    expect(state?.icon).toBe(icon)
    expect(state?.title.length).toBeGreaterThan(0)
  })
})

describe('bingTrafficTotals', () => {
  it('sums clicks and impressions and derives CTR', () => {
    const rows = [
      { date: '2026-09-01', clicks: 10, impressions: 100 },
      { date: '2026-09-02', clicks: 5, impressions: 100 },
    ] as TrafficRows
    expect(bingTrafficTotals(rows)).toEqual({ clicks: 15, impressions: 200, ctr: 0.075 })
  })

  it('reports zero CTR rather than NaN when nothing was impressed', () => {
    expect(bingTrafficTotals([] as TrafficRows)).toEqual({ clicks: 0, impressions: 0, ctr: 0 })
    expect(formatBingCtr(bingTrafficTotals([] as TrafficRows).ctr)).toBe('0.0%')
  })
})

describe('bingRequestErrorState', () => {
  // Every status here is raised before Bing is reached, so none of them may
  // read as a Bing connection state or offer a reconnect.
  it('names a throttled request as a delay', () => {
    expect(bingRequestErrorState({ statusCode: 429 }).title).toBe('Bing delayed this request')
  })

  it('names an unlinked Site rather than an authorization problem', () => {
    expect(bingRequestErrorState({ statusCode: 404 }).title).toBe('Bing is not available for this Site')
  })

  it('falls back to a retry for an unclassified failure', () => {
    expect(bingRequestErrorState(new Error('boom')).title).toBe('Bing data failed to load')
  })
})

describe('projectBingIntegrationState', () => {
  const read = (tag: 'ready' | 'disconnected' | 'reauth') => ({ _tag: 'Read', connection: { _tag: tag } }) as const

  it('reads as unavailable while the Bing flag is off, whatever the Sites report', () => {
    expect(projectBingIntegrationState({ enabled: false, linkedSites: 2, reads: [read('ready'), read('ready')] }))
      .toEqual({ _tag: 'unavailable' })
  })

  it('waits on Search Console when no Site is linked yet', () => {
    expect(projectBingIntegrationState({ enabled: true, linkedSites: 0, reads: [] }))
      .toEqual({ _tag: 'awaiting-search-console' })
  })

  it('checks while the per-Site reads are in flight', () => {
    expect(projectBingIntegrationState({ enabled: true, linkedSites: 2, reads: null }))
      .toEqual({ _tag: 'checking' })
  })

  it('reports a failed read when no Site answered', () => {
    expect(projectBingIntegrationState({ enabled: true, linkedSites: 2, reads: [{ _tag: 'Failed' }, { _tag: 'Failed' }] }))
      .toEqual({ _tag: 'read-failed' })
  })

  it('tallies each Site by the state Bing reported', () => {
    const state = projectBingIntegrationState({
      enabled: true,
      linkedSites: 5,
      reads: [
        read('ready'),
        read('reauth'),
        read('disconnected'),
        { _tag: 'Read', connection: { _tag: 'verification-required', remoteSiteUrl: 'https://example.com', verification: { _tag: 'cname', name: 'a.example.com', value: 'verify.bing.com' } } },
        { _tag: 'Failed' },
      ],
    })
    expect(state).toEqual({ _tag: 'ready', total: 5, connected: 1, verification: 1, reconnect: 1, failed: 1 })
  })
})

describe('bingIntegrationStatusLine', () => {
  const ready = { _tag: 'ready', total: 3, connected: 2, verification: 0, reconnect: 0, failed: 0 } as const

  it('states coverage as Sites connected out of Sites linked', () => {
    expect(bingIntegrationStatusLine(ready)).toBe('2 of 3 Sites connected')
  })

  it('leads with the reconnect when a Site needs one', () => {
    expect(bingIntegrationStatusLine({ ...ready, reconnect: 1 })).toBe('Reconnect needed for 1 Site. 2 of 3 Sites connected')
    expect(bingIntegrationStatusLine({ ...ready, reconnect: 2 })).toBe('Reconnect needed for 2 Sites. 2 of 3 Sites connected')
  })

  it('says the Integration is not available yet while the flag is off', () => {
    expect(bingIntegrationStatusLine({ _tag: 'unavailable' })).toBe('Not available yet')
  })
})
