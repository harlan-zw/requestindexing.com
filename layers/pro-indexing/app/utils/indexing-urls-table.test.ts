import type { DiagnosticsIssue } from './indexing-urls-table'
import { describe, expect, it } from 'vitest'
import {
  formatCrawlDay,
  groupIssuesBySeverity,
  inspectionStateLabel,
  inspectionStateSeverity,
  issueButtonCount,
  pageFetchStateLabels,
  readInspectOutcome,
  retryAfterLabel,
  richResultsDistribution,
  sitemapMembership,
} from './indexing-urls-table'

function issue(type: string, severity: DiagnosticsIssue['severity'], count: number): DiagnosticsIssue {
  return { type, label: type, severity, count, description: '', fix: '' }
}

describe('groupIssuesBySeverity', () => {
  it('orders errors, then warnings, then info, and sums each group', () => {
    const groups = groupIssuesBySeverity([
      issue('stale_crawl', 'info', 4),
      issue('crawled_not_indexed', 'warning', 10),
      issue('not_found', 'error', 2),
      issue('server_error', 'error', 3),
    ])
    expect(groups.map(group => [group.severity, group.issues.map(i => i.type), group.total])).toEqual([
      ['error', ['not_found', 'server_error'], 5],
      ['warning', ['crawled_not_indexed'], 10],
      ['info', ['stale_crawl'], 4],
    ])
  })

  it('leaves out issues with no URLs and groups left empty', () => {
    const groups = groupIssuesBySeverity([
      issue('not_found', 'error', 0),
      issue('crawled_not_indexed', 'warning', 7),
    ])
    expect(groups.map(group => group.severity)).toEqual(['warning'])
  })

  it('returns no groups for a Site with no issues', () => {
    expect(groupIssuesBySeverity([])).toEqual([])
  })
})

describe('issueButtonCount', () => {
  it('shows the error total when any error exists', () => {
    const groups = groupIssuesBySeverity([issue('not_found', 'error', 2), issue('crawled_not_indexed', 'warning', 9)])
    expect(issueButtonCount(groups)).toEqual({ severity: 'error', count: 2 })
  })

  it('falls back to the warning total', () => {
    expect(issueButtonCount(groupIssuesBySeverity([issue('crawled_not_indexed', 'warning', 9)])))
      .toEqual({ severity: 'warning', count: 9 })
  })

  it('shows no count when only info issues remain', () => {
    expect(issueButtonCount(groupIssuesBySeverity([issue('stale_crawl', 'info', 3)]))).toBeNull()
  })
})

describe('inspectionStateSeverity', () => {
  it.each([
    ['ALLOWED', ['ALLOWED'], 'success'],
    ['DISALLOWED', ['ALLOWED'], 'error'],
    ['ROBOTS_TXT_STATE_UNSPECIFIED', ['ALLOWED'], 'neutral'],
    ['NEUTRAL', ['PASS'], 'neutral'],
    [null, ['PASS'], 'neutral'],
  ] as const)('reads %s as %s', (raw, successValues, severity) => {
    expect(inspectionStateSeverity(raw, successValues)).toBe(severity)
  })
})

describe('inspectionStateLabel', () => {
  it('uses the known label', () => {
    expect(inspectionStateLabel('SOFT_404', pageFetchStateLabels)).toBe('Soft 404')
  })

  it('title-cases a state the map does not know yet', () => {
    expect(inspectionStateLabel('BLOCKED_4XX', pageFetchStateLabels)).toBe('Blocked 4xx')
  })

  it('reads a missing state as unknown', () => {
    expect(inspectionStateLabel(null, pageFetchStateLabels)).toBe('Unknown')
  })
})

describe('sitemapMembership', () => {
  it.each([
    ['Submitted and indexed', true],
    ['Indexed, not submitted in sitemap', false],
    ['Crawled - currently not indexed', null],
    [null, null],
  ])('reads "%s" as %s', (coverageState, member) => {
    expect(sitemapMembership({ coverageState })).toBe(member)
  })
})

describe('richResultsDistribution', () => {
  it('counts each type as valid or invalid from the URL verdict, invalid first', () => {
    const rows = richResultsDistribution([
      { richResultsVerdict: 'PASS', richResultsItems: [{ richResultType: 'FAQ' }, { richResultType: 'Breadcrumbs' }] },
      { richResultsVerdict: 'FAIL', richResultsItems: [{ richResultType: 'Product snippets' }] },
      { richResultsVerdict: 'PARTIAL', richResultsItems: [{ richResultType: 'FAQ' }] },
      { richResultsVerdict: 'PASS', richResultsItems: [{ richResultType: 'Breadcrumbs' }] },
    ])
    expect(rows).toEqual([
      { type: 'FAQ', valid: 1, invalid: 1 },
      { type: 'Product snippets', valid: 0, invalid: 1 },
      { type: 'Breadcrumbs', valid: 2, invalid: 0 },
    ])
  })

  it('skips rows with no items or a neutral verdict', () => {
    expect(richResultsDistribution([
      { richResultsVerdict: 'PASS', richResultsItems: [] },
      { richResultsVerdict: 'VERDICT_UNSPECIFIED', richResultsItems: [{ richResultType: 'FAQ' }] },
      { richResultsVerdict: null, richResultsItems: null },
    ])).toEqual([])
  })
})

describe('formatCrawlDay', () => {
  const now = new Date('2026-09-30T02:00:00.000Z')

  it.each([
    ['2026-09-30T00:10:00.000Z', 'Today'],
    ['2026-09-29T23:59:00.000Z', 'Yesterday'],
    ['2026-09-14T12:00:00.000Z', 'Sep 14'],
  ])('reads %s as %s in UTC', (value, label) => {
    expect(formatCrawlDay(value, now)).toBe(label)
  })

  it('returns nothing for a missing or broken date', () => {
    expect(formatCrawlDay(null, now)).toBeNull()
    expect(formatCrawlDay('not a date', now)).toBeNull()
  })
})

describe('retryAfterLabel', () => {
  it.each([
    [600, 'in less than an hour'],
    [3600, 'in about 1 hour'],
    [5 * 3600 + 900, 'in about 5 hours'],
  ])('reads %i seconds as "%s"', (seconds, label) => {
    expect(retryAfterLabel(seconds)).toBe(label)
  })
})

describe('readInspectOutcome', () => {
  const rateLimit = { reserved: 1, remaining: 1799, limit: 1800 }
  const base = { siteId: 's_1', rateLimit, results: [], errors: [], skipped: [] }
  const result = {
    url: 'https://example.com/a',
    verdict: 'PASS',
    coverageState: 'Submitted and indexed',
    indexingState: null,
    robotsTxtState: null,
    pageFetchState: null,
    lastCrawlTime: null,
    crawlingUserAgent: null,
    userCanonical: null,
    googleCanonical: null,
    sitemaps: null,
    referringUrls: null,
    mobileVerdict: null,
    mobileIssues: null,
    richResultsVerdict: null,
    richResultsItems: null,
    inspectionResultLink: null,
  }

  it('reports the rate limit with its reset time', () => {
    expect(readInspectOutcome({
      error: 'rate_limited',
      message: 'limit',
      rateLimit: { reserved: 0, remaining: 0, limit: 1800 },
      retryAfterSeconds: 7200,
    })).toEqual({ _tag: 'RateLimited', retryAfterSeconds: 7200 })
  })

  it('reports a Free allowance refusal with its own message, apart from the daily limit', () => {
    const message = 'You used the 5,000 URL Inspections in this month\'s Free allowance. URL Inspection starts again on November 1.'
    expect(readInspectOutcome({
      error: 'refused',
      refusal: { reason: 'inspection_allowance', limit: 5_000, resetsAt: '2026-11-01' },
      message,
    })).toEqual({ _tag: 'Refused', message })
  })

  it('reports the new coverage state and the quota left', () => {
    expect(readInspectOutcome({ ...base, results: [result] }))
      .toEqual({ _tag: 'Checked', coverage: 'Submitted and indexed', remaining: 1799, limit: 1800 })
  })

  it('falls back to the verdict when Google reports no coverage state', () => {
    const outcome = readInspectOutcome({ ...base, results: [{ ...result, coverageState: null, verdict: 'FAIL' }] })
    expect(outcome).toMatchObject({ _tag: 'Checked', coverage: 'Not indexed' })
  })

  it('reports an engine error as a failed check', () => {
    expect(readInspectOutcome({ ...base, errors: [{ url: result.url, error: 'Google returned 500' }] }))
      .toEqual({ _tag: 'Failed', reason: 'Google returned 500', remaining: 1799, limit: 1800 })
  })

  it('reports a skipped URL as a failed check with the skip reason', () => {
    expect(readInspectOutcome({ ...base, skipped: [{ url: result.url, reason: 'URL is outside this property' }] }))
      .toMatchObject({ _tag: 'Failed', reason: 'URL is outside this property' })
  })
})
