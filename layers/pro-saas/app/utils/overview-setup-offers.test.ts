import type { BingIntegrationSummary } from '#layers/pro-gsc/app/utils/bing-integration-view'
import type { FreeAllowanceView, MeteredEntitlements } from '#layers/pro-gsc/shared/free-allowance'
import { resolveProShellCopy } from '@nuxtseo/pro-shell/shared/copy'
import { selectSetupOffers } from '@nuxtseo/pro-shell/shared/setup-offers'
import { describe, expect, it } from 'vitest'
import { PRO_SHELL_COPY_OVERRIDES, PRO_SHELL_ROUTES, REQUEST_INDEXING_SETUP_OFFER_COPY } from '../pro-shell'
import {
  anotherSiteCompletion,
  bingSetupCompletion,
  buildOverviewSetupOffers,
  buildSiteSetupOffers,
  indexNowSetupCompletion,
  watchedUrlsSetupCompletion,
} from './overview-setup-offers'

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

  it('offers it with no cap, waits while unread, hides on unavailable, and leaves the first Site to the setup card', () => {
    expect(anotherSiteCompletion({ siteCount: 4, allowance: { _tag: 'Hidden' } })).toEqual({ _tag: 'pending' })
    expect(anotherSiteCompletion({ siteCount: 2, allowance: null })).toEqual({ _tag: 'unknown' })
    expect(anotherSiteCompletion({ siteCount: 2, allowance: { _tag: 'Unavailable' } })).toEqual({ _tag: 'unavailable' })
    expect(anotherSiteCompletion({ siteCount: 0, allowance: { _tag: 'Hidden' } })).toEqual({ _tag: 'unavailable' })
  })
})

describe('indexNowSetupCompletion', () => {
  it('offers IndexNow until the Site key is verified', () => {
    expect(indexNowSetupCompletion({ _tag: 'ready', value: { _tag: 'disconnected' } })).toEqual({ _tag: 'pending' })
    expect(indexNowSetupCompletion({ _tag: 'ready', value: { _tag: 'verification-required' } })).toEqual({ _tag: 'pending' })
    expect(indexNowSetupCompletion({ _tag: 'ready', value: { _tag: 'connected' } })).toEqual({ _tag: 'complete' })
  })

  it('waits only while the read runs, and shows no card without a Site, write access, or a read', () => {
    expect(indexNowSetupCompletion({ _tag: 'checking' })).toEqual({ _tag: 'unknown' })
    for (const read of [{ _tag: 'no-site' }, { _tag: 'read-only' }, { _tag: 'read-failed' }] as const)
      expect(indexNowSetupCompletion(read)).toEqual({ _tag: 'unavailable' })
  })
})

describe('watchedUrlsSetupCompletion', () => {
  it('offers Watched URLs until the Site watches one URL', () => {
    expect(watchedUrlsSetupCompletion({ _tag: 'ready', value: { watched: [] } })).toEqual({ _tag: 'pending' })
    expect(watchedUrlsSetupCompletion({ _tag: 'ready', value: { watched: [{ url: 'https://example.com/' }] } })).toEqual({ _tag: 'complete' })
    expect(watchedUrlsSetupCompletion({ _tag: 'read-failed' })).toEqual({ _tag: 'unavailable' })
  })
})

describe('buildOverviewSetupOffers', () => {
  const pending = { _tag: 'pending' } as const
  const copy = resolveProShellCopy(PRO_SHELL_COPY_OVERRIDES)
  function offers(siteId: string | null) {
    return buildOverviewSetupOffers({
      routes: PRO_SHELL_ROUTES,
      shellCopy: copy.setupOffers,
      copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
      feedbackAction: copy.feedback.action,
      siteId,
      completion: { bing: pending, anotherSite: pending, indexNow: pending, watchedUrls: pending },
    })
  }

  it('leads with Beta feedback then IndexNow, and never offers the agent skill, MCP, or API', () => {
    expect(selectSetupOffers(offers('site_app_1'), new Set()).map(offer => offer.key)).toEqual(['beta-feedback', 'indexnow', 'bing', 'watched-urls'])
    expect(selectSetupOffers(offers('site_app_1'), new Set(['beta-feedback'])).map(offer => offer.key)).toEqual(['indexnow', 'bing', 'watched-urls', 'another-site'])
    expect(selectSetupOffers(offers('site_app_1'), new Set(['beta-feedback', 'indexnow'])).map(offer => offer.key)).toEqual(['bing', 'watched-urls', 'another-site'])
  })

  it('runs Beta feedback in place and opens IndexNow and Watched URLs by the Site app id', () => {
    const actions = Object.fromEntries(offers('site_app_1').map(offer => [offer.key, offer.action]))
    expect(actions['beta-feedback']).toEqual({ _tag: 'Run', pending: false })
    expect(actions.indexnow).toEqual({ _tag: 'Link', to: '/pro/dashboard/sites/site_app_1/indexing/indexnow' })
    expect(actions['watched-urls']).toEqual({ _tag: 'Link', to: '/pro/dashboard/sites/site_app_1/indexing/watched' })
  })

  it('keeps Beta feedback and the shell offers without a linked Site', () => {
    expect(offers(null).map(offer => offer.key)).toEqual(['beta-feedback', 'bing', 'another-site'])
  })
})

describe('buildSiteSetupOffers', () => {
  const pending = { _tag: 'pending' } as const
  const feedbackAction = resolveProShellCopy(PRO_SHELL_COPY_OVERRIDES).feedback.action
  function siteOffers(siteId: string) {
    return buildSiteSetupOffers({
      copy: REQUEST_INDEXING_SETUP_OFFER_COPY,
      feedbackAction,
      siteId,
      completion: { indexNow: pending, watchedUrls: pending },
    })
  }
  function dismissKey(offers: ReturnType<typeof siteOffers>, key: string) {
    return offers.find(offer => offer.key === key)!.dismissKey
  }

  it('offers Beta feedback plus the Site\'s IndexNow and Watched URLs, opened by its app id', () => {
    expect(selectSetupOffers(siteOffers('site_app_1'), new Set()).map(offer => [offer.key, offer.action])).toEqual([
      ['beta-feedback', { _tag: 'Run', pending: false }],
      ['indexnow', { _tag: 'Link', to: '/pro/dashboard/sites/site_app_1/indexing/indexnow' }],
      ['watched-urls', { _tag: 'Link', to: '/pro/dashboard/sites/site_app_1/indexing/watched' }],
    ])
  })

  it('keeps Site-offer dismissals per Site and Beta feedback account-wide', () => {
    const dismissed = new Set([dismissKey(siteOffers('site_a'), 'indexnow')])
    expect(selectSetupOffers(siteOffers('site_a'), dismissed).map(offer => offer.key)).toEqual(['beta-feedback', 'watched-urls'])
    expect(selectSetupOffers(siteOffers('site_b'), dismissed).map(offer => offer.key)).toEqual(['beta-feedback', 'indexnow', 'watched-urls'])

    const dismissedFeedback = new Set([dismissKey(siteOffers('site_a'), 'beta-feedback')])
    expect(selectSetupOffers(siteOffers('site_b'), dismissedFeedback).map(offer => offer.key)).toEqual(['indexnow', 'watched-urls'])
  })
})
