import type { BingIntegrationSummary } from '#layers/pro-gsc/app/utils/bing-integration-view'
import type { FreeAllowanceView, MeteredEntitlements } from '#layers/pro-gsc/shared/free-allowance'
import { describe, expect, it } from 'vitest'
import { anotherSiteCompletion, bingSetupCompletion } from './overview-setup-offers'

function summary(pending: BingIntegrationSummary['pending']): BingIntegrationSummary {
  return { linked: 0, eligible: 2, linkable: 0, sitemapsMissing: 0, notEnabled: 0, pending }
}

function metered(used: number, allowance: number): FreeAllowanceView {
  const entitlements: MeteredEntitlements = {
    mode: 'metered',
    phase: 'beta',
    meters: {
      sites: { used, allowance },
      preservedRows: { used: 0, allowance: 250_000 },
      urlInspections: { used: 0, allowance: 5_000, resetsAt: '2026-11-01' },
    },
    sizeLimitRowsPerDay: 2_500,
    heldSites: [],
  }
  return { _tag: 'Metered', entitlements }
}

describe('bingSetupCompletion', () => {
  it('offers Bing while no Site is linked, and asks to reconnect a broken link', () => {
    expect(bingSetupCompletion({ _tag: 'ready', summary: summary('connect') })).toEqual({ _tag: 'pending' })
    expect(bingSetupCompletion({ _tag: 'ready', summary: summary('reconnect') })).toEqual({ _tag: 'reconnect' })
    expect(bingSetupCompletion({ _tag: 'ready', summary: summary(null) })).toEqual({ _tag: 'complete' })
  })

  it('shows no card while the flag is off, gscdump does not offer it, or the read failed', () => {
    for (const state of [{ _tag: 'unavailable' }, { _tag: 'not-offered' }, { _tag: 'read-failed' }] as const)
      expect(bingSetupCompletion(state)).toEqual({ _tag: 'unavailable' })
    expect(bingSetupCompletion({ _tag: 'checking' })).toEqual({ _tag: 'unknown' })
  })
})

describe('anotherSiteCompletion', () => {
  it('offers another Site while the Free allowance has room, and stops when it is full', () => {
    expect(anotherSiteCompletion({ siteCount: 2, allowance: metered(2, 3) })).toEqual({ _tag: 'pending' })
    expect(anotherSiteCompletion({ siteCount: 3, allowance: metered(3, 3) })).toEqual({ _tag: 'complete' })
  })

  it('offers it with no cap, waits on an unread allowance, and leaves the first Site to the setup card', () => {
    expect(anotherSiteCompletion({ siteCount: 4, allowance: { _tag: 'Hidden' } })).toEqual({ _tag: 'pending' })
    expect(anotherSiteCompletion({ siteCount: 2, allowance: null })).toEqual({ _tag: 'unknown' })
    expect(anotherSiteCompletion({ siteCount: 2, allowance: { _tag: 'Unavailable' } })).toEqual({ _tag: 'unknown' })
    expect(anotherSiteCompletion({ siteCount: 0, allowance: { _tag: 'Hidden' } })).toEqual({ _tag: 'unavailable' })
  })
})
