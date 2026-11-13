import { describe, expect, it } from 'vitest'
import { changesRollupFromTransitions, sitemapProblemsFrom, toIndexingInspectResult, toIndexingSite, toPortfolioEntry } from './indexing-source'

const site = { id: 's_one', label: 'example.com', url: 'sc-domain:example.com', gscdumpSiteId: 'g_one' }

describe('toIndexingSite', () => {
  it('addresses a Site by its route id and reads data with its gscdump id', () => {
    expect(toIndexingSite(site)).toEqual({ id: 's_one', ref: 's_one', label: 'example.com', url: 'https://example.com', dataId: 'g_one' })
  })

  it('reads nothing for a Site with no Search Console link', () => {
    expect(toIndexingSite({ ...site, gscdumpSiteId: null }).dataId).toBeNull()
  })
})

describe('toPortfolioEntry', () => {
  const data = { summary: { indexed: 8, totalUrls: 10, indexedPercent: 80 }, trend: [{ date: '2026-11-12', totalUrls: 10, indexedCount: 8, indexedPercent: 80 }] }

  it('keeps the last readings while a refresh runs or fails', () => {
    expect(toPortfolioEntry(site, { _tag: 'Loading', last: data })).toMatchObject({ read: { _tag: 'loading' }, summary: data.summary })
    expect(toPortfolioEntry(site, { _tag: 'Failed', last: data })).toMatchObject({ read: { _tag: 'failed' }, trend: data.trend })
  })

  it('has no readings for an unlinked Site', () => {
    expect(toPortfolioEntry({ ...site, gscdumpSiteId: null }, { _tag: 'NotConnected' })).toMatchObject({ read: { _tag: 'idle' }, summary: null, trend: [] })
  })
})

describe('toIndexingInspectResult', () => {
  const rateLimited = { error: 'rate_limited' as const, message: 'Daily limit', rateLimit: { reserved: 0 as const, remaining: 0 as const, limit: 1800 }, retryAfterSeconds: 3600 }

  it('passes the daily limit through, so the table stops offering a re-check', () => {
    expect(toIndexingInspectResult(rateLimited)).toBe(rateLimited)
  })

  it('throws a refusal with this app\'s message, so the table reports a failed re-check', () => {
    expect(() => toIndexingInspectResult({ error: 'refused', message: 'This Site is Held.', refusal: {} as never }))
      .toThrow('This Site is Held.')
  })
})

describe('changesRollupFromTransitions', () => {
  const at = (day: string) => `${day}T04:00:00.000Z`

  it('counts a verdict leaving PASS as opened and reaching PASS as cleared, by the day it was seen', () => {
    const rollup = changesRollupFromTransitions([
      { siteId: 's_one', transitions: [
        { field: 'indexStatus', fromValue: 'PASS', toValue: 'NEUTRAL', changedBefore: at('2026-11-10') },
        { field: 'indexStatus', fromValue: 'PASS', toValue: 'FAIL', changedBefore: at('2026-11-10') },
        { field: 'indexStatus', fromValue: 'NEUTRAL', toValue: 'PASS', changedBefore: at('2026-11-12') },
      ] },
      { siteId: 's_two', transitions: [{ field: 'indexStatus', fromValue: 'NEUTRAL', toValue: 'PASS', changedBefore: at('2026-11-10') }] },
    ], '2026-11-13')
    expect(rollup).toEqual({
      windowDays: 28,
      through: '2026-11-13',
      rows: [
        { siteId: 's_one', day: '2026-11-10', opened: 2, cleared: 0 },
        { siteId: 's_two', day: '2026-11-10', opened: 0, cleared: 1 },
        { siteId: 's_one', day: '2026-11-12', opened: 0, cleared: 1 },
      ],
    })
  })

  it('ignores other fields, changes that keep the index state, and days outside the window', () => {
    const rollup = changesRollupFromTransitions([{ siteId: 's_one', transitions: [
      { field: 'coverageState', fromValue: 'Submitted and indexed', toValue: 'Soft 404', changedBefore: at('2026-11-10') },
      { field: 'indexStatus', fromValue: 'NEUTRAL', toValue: 'FAIL', changedBefore: at('2026-11-10') },
      { field: 'indexStatus', fromValue: 'PASS', toValue: 'NEUTRAL', changedBefore: at('2026-10-01') },
    ] }], '2026-11-13')
    expect(rollup.rows).toEqual([])
  })
})

describe('sitemapProblemsFrom', () => {
  it('lists a failed probe as unreachable and Search Console errors as errors', () => {
    expect(sitemapProblemsFrom([
      { siteId: 's_ok', liveness: { status: 'reachable', statusCode: 200 }, sitemaps: { sitemaps: [{ errors: 0 }] } },
      { siteId: 's_down', liveness: { status: 'error', statusCode: 503 }, sitemaps: null },
      { siteId: 's_errors', liveness: { status: 'reachable', statusCode: 200 }, sitemaps: { sitemaps: [{ errors: 3 }] } },
      { siteId: 's_dropped', liveness: null, sitemaps: { sitemaps: [{ errors: 1, feed: { _tag: 'dropped', status: 404, since: 1 } }] } },
      { siteId: 's_unknown', liveness: null, sitemaps: null },
    ])).toEqual({ unreachable: ['s_down'], errors: ['s_errors'] })
  })
})
