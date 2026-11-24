import { describe, expect, it } from 'vitest'
import { defaultReportSite, firstReportWithoutVerdicts, formatReportDate, verdictStatus } from './first-report'

describe('a report with no saved verdict', () => {
  it.each(['waiting_for_sitemaps', 'discovering', 'checking'] as const)('waits while gscdump is %s, with no fresh URL Inspection', (status) => {
    expect(firstReportWithoutVerdicts({ status, reason: null })).toEqual({ _tag: 'Collecting', phase: status })
  })

  it.each([
    ['daily_budget_exhausted', 'daily'],
    ['inspection_allowance', 'monthly'],
    ['site_held', 'other'],
    [null, 'other'],
  ] as const)('names a %s limit only when the engine names it', (reason, limit) => {
    expect(firstReportWithoutVerdicts({ status: 'budget_exhausted', reason })).toEqual({ _tag: 'Limited', limit })
  })

  it('sends a missing scope or permission to its fix instead of a URL Inspection', () => {
    expect(firstReportWithoutVerdicts({ status: 'missing_scope', reason: null })).toEqual({ _tag: 'Blocked', reason: 'scope' })
    expect(firstReportWithoutVerdicts({ status: 'insufficient_permission', reason: null })).toEqual({ _tag: 'Blocked', reason: 'permission' })
  })

  it.each(['ready', 'no_urls', 'failed', 'not_requested'] as const)('offers the reviewed URL Inspection when the engine is %s', (status) => {
    expect(firstReportWithoutVerdicts({ status, reason: null })).toEqual({ _tag: 'NoVerdicts' })
  })
})

it('marks only an indexed verdict as success', () => {
  expect([verdictStatus('PASS'), verdictStatus('NEUTRAL'), verdictStatus('FAIL'), verdictStatus('PARTIAL'), verdictStatus(null)])
    .toEqual(['success', 'warning', 'warning', 'warning', 'neutral'])
})

it('shows a capture time as its UTC calendar date, never raw ISO', () => {
  expect(formatReportDate('2026-11-24T23:30:00Z')).toBe('Nov 24, 2026')
  expect(formatReportDate('2026-11-24T00:10:00+10:00')).toBe('Nov 23, 2026')
  expect(formatReportDate('not a date')).toBe('not a date')
})

describe('the Site the report opens on', () => {
  const site = (siteId: string, indexing: 'ready' | 'checking' | 'discovering' | null) => ({ siteId, processing: indexing ? { indexing } : null })

  it('prefers a Site whose URL Inspection is ready, then one inspecting now', () => {
    expect(defaultReportSite([site('a', 'discovering'), site('b', 'checking'), site('c', 'ready')])?.siteId).toBe('c')
    expect(defaultReportSite([site('a', null), site('b', 'checking')])?.siteId).toBe('b')
  })

  it('falls back to the first Site, and to none for an empty list', () => {
    expect(defaultReportSite([site('a', null), site('b', 'discovering')])?.siteId).toBe('a')
    expect(defaultReportSite([])).toBeUndefined()
  })
})
