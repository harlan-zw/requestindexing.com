import type { PartnerUserEntitlementsV1 } from '@gscdump/contracts/v1'
import type { EntitlementsRead } from './free-allowance'
import { describe, expect, it } from 'vitest'
import { decideSiteConnect, freeAllowanceView, siteAllowanceOf } from './free-allowance'

function metered(sites: { used: number, allowance: number }): PartnerUserEntitlementsV1 {
  return {
    mode: 'metered',
    phase: 'beta',
    meters: {
      sites,
      preservedRows: { used: 120_000, allowance: 250_000 },
      urlInspections: { used: 310, allowance: 5_000, resetsAt: '2026-11-01' },
    },
    sizeLimitRowsPerDay: 2_500,
    heldSites: [],
  }
}

const loaded = (entitlements: PartnerUserEntitlementsV1): EntitlementsRead => ({ _tag: 'Loaded', entitlements })

describe('decideSiteConnect', () => {
  it('allows any number of Sites while the partner is exempt', () => {
    const decision = decideSiteConnect(siteAllowanceOf(loaded({ mode: 'exempt' })))

    expect(decision).toEqual({ _tag: 'Allow' })
  })

  it('allows a Site while the Free allowance has room', () => {
    const decision = decideSiteConnect(siteAllowanceOf(loaded(metered({ used: 2, allowance: 3 }))))

    expect(decision).toEqual({ _tag: 'Allow' })
  })

  it('refuses a Site once the Free allowance is full, with the allowance as the limit', () => {
    const decision = decideSiteConnect(siteAllowanceOf(loaded(metered({ used: 3, allowance: 3 }))))

    expect(decision).toEqual({ _tag: 'Refuse', refusal: { reason: 'site_allowance', limit: 3 } })
  })

  it('refuses a grandfathered owner at the override, not at the default', () => {
    const decision = decideSiteConnect(siteAllowanceOf(loaded(metered({ used: 8, allowance: 8 }))))

    expect(decision).toEqual({ _tag: 'Refuse', refusal: { reason: 'site_allowance', limit: 8 } })
  })

  it.each<EntitlementsRead>([
    { _tag: 'Skipped' },
    { _tag: 'Unavailable', reason: 'gscdump answered 503' },
  ])('allows a Site when the allowance is unknown ($_tag), because gscdump still refuses at registration', (read) => {
    expect(decideSiteConnect(siteAllowanceOf(read))).toEqual({ _tag: 'Allow' })
  })
})

describe('freeAllowanceView', () => {
  it('shows no meters while the partner is exempt', () => {
    expect(freeAllowanceView(loaded({ mode: 'exempt' }))).toEqual({ _tag: 'Hidden' })
  })

  it('shows no meters for an account gscdump does not know yet', () => {
    expect(freeAllowanceView({ _tag: 'Skipped' })).toEqual({ _tag: 'Hidden' })
  })

  it('reports a failed read so the page can offer a retry', () => {
    expect(freeAllowanceView({ _tag: 'Unavailable', reason: 'timeout' })).toEqual({ _tag: 'Unavailable' })
  })

  it('passes the metered entitlements through', () => {
    const entitlements = metered({ used: 1, allowance: 3 })

    expect(freeAllowanceView(loaded(entitlements))).toEqual({ _tag: 'Metered', entitlements })
  })
})
