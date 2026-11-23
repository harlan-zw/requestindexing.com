import type { PartnerLifecycleSite } from '@gscdump/contracts'
import type { SemanticStatus } from '@nuxtseo/design-system/app/composables/semanticColors'
import type { PageEvidence } from './page-evidence'
import { GSC_CONNECT_COPY } from '#layers/pro-saas/shared/gsc-connect-copy'
import { URL_INSPECTION_ACTIVITY_LABELS } from '#layers/pro-saas/shared/live-work'
import { PAGE_SETUP_COPY } from '#layers/pro-saas/shared/page-task'
import { SETUP_EXPERIMENT_COPY } from '#layers/pro-saas/shared/setup-experiments'

// COPY.md, First Site report. A string that COPY.md reuses verbatim comes
// from its own constant, so the two places cannot drift apart.
export const FIRST_REPORT_COPY = {
  heading: 'Check which pages Google indexed',
  site: 'Site',
  loadingSaved: 'Loading saved Google verdicts',
  captured: PAGE_SETUP_COPY.captured,
  notReported: PAGE_SETUP_COPY.notReported,
  sampleLimit: 'This sample covers only the URLs listed here.',
  collecting: 'Google\'s verdicts appear here when the first URL Inspections finish.',
  phase: {
    waiting_for_sitemaps: URL_INSPECTION_ACTIVITY_LABELS.waiting_for_sitemaps,
    discovering: URL_INSPECTION_ACTIVITY_LABELS.discovering,
    checking: URL_INSPECTION_ACTIVITY_LABELS.checking,
  },
  limit: {
    daily: PAGE_SETUP_COPY.dailyQuota,
    monthly: URL_INSPECTION_ACTIVITY_LABELS.monthlyLimit,
    other: URL_INSPECTION_ACTIVITY_LABELS.otherLimit,
  },
  noVerdicts: 'This Site has no saved Google verdicts yet.',
  blocked: {
    scope: GSC_CONNECT_COPY.connectMissingScope,
    permission: SETUP_EXPERIMENT_COPY.propertyRecovery,
  },
  savedUnavailable: 'Saved Google verdicts could not load. Select Check again to try again.',
  retry: 'Check again',
  help: 'Preview up to 10 URLs from your Sitemap. The preview uses no URL Inspections.',
  preview: 'Preview URLs',
  sitemapDate: 'Sitemap URLs captured on',
  cost: 'Each completed URL Inspection uses one from your Free allowance. These checks also use Google\'s daily quota.',
  inspect: 'Inspect these URLs',
  refresh: 'Refresh preview',
  empty: 'No matching Sitemap URLs yet. Refresh the preview later.',
  incomplete: 'We found no matching URLs in the part we checked. Check your Sitemaps or refresh the preview later.',
  unavailable: 'The preview could not load. Select Refresh preview to try again.',
  changed: 'This Site or its Sitemap URLs changed. Select Refresh preview before inspecting.',
  result: 'Google\'s evidence for these URLs',
  noResult: 'Google returned no inspection result for this URL.',
  skipped: 'URL Inspection skipped',
  error: 'URL Inspection failed',
  loading: 'Loading Sitemap URLs',
  selected: (count: number) => `${count} ${count === 1 ? 'URL' : 'URLs'} to inspect.`,
  pending: 'Leaving this page won\'t cancel inspections already sent.',
  viewChanged: 'Refresh the preview before recording its evidence.',
  uncertain: 'We could not confirm what happened. Check saved results before starting another inspection.',
  saved: 'Read saved results',
  viewOnly: 'Your Team role allows viewing only.',
} as const

/** The most saved verdicts the report shows. gscdump lists not-indexed URLs first, then the newest capture. */
export const FIRST_REPORT_SAVED_LIMIT = 5

type IndexingStatus = PartnerLifecycleSite['indexing']['status']
export type FirstReportPhase = keyof typeof FIRST_REPORT_COPY.phase

/**
 * The saved read. It spends no URL Inspection. With no saved verdict, the
 * engine's own URL Inspection status decides what the reader sees: gscdump
 * inspects a partner Site's sitemap URLs by itself, so a fresh URL Inspection
 * is offered only when the engine is not inspecting the Site.
 */
export type FirstReportSaved
  = | { _tag: 'Verdicts', rows: PageEvidence[], token: string }
    | { _tag: 'Collecting', phase: FirstReportPhase }
    | { _tag: 'Limited', limit: keyof typeof FIRST_REPORT_COPY.limit }
    | { _tag: 'Blocked', reason: keyof typeof FIRST_REPORT_COPY.blocked }
    | { _tag: 'NoVerdicts' }
    | { _tag: 'Unknown' }

export type FirstReportWithoutVerdicts = Exclude<FirstReportSaved, { _tag: 'Verdicts' | 'Unknown' }>
/** An engine state that rules out a fresh URL Inspection: collecting, limited, or blocked. */
export type FirstReportHold = Exclude<FirstReportWithoutVerdicts, { _tag: 'NoVerdicts' }>

/** What an empty saved read means, from the engine's live URL Inspection status. */
export function firstReportWithoutVerdicts(indexing: { status: IndexingStatus, reason: string | null }): FirstReportWithoutVerdicts {
  switch (indexing.status) {
    case 'waiting_for_sitemaps':
    case 'discovering':
    case 'checking':
      return { _tag: 'Collecting', phase: indexing.status }
    case 'budget_exhausted':
      return { _tag: 'Limited', limit: indexing.reason === 'daily_budget_exhausted' ? 'daily' : indexing.reason === 'inspection_allowance' ? 'monthly' : 'other' }
    case 'missing_scope':
      return { _tag: 'Blocked', reason: 'scope' }
    case 'insufficient_permission':
      return { _tag: 'Blocked', reason: 'permission' }
    case 'not_requested':
    case 'ready':
    case 'no_urls':
    case 'failed':
      return { _tag: 'NoVerdicts' }
  }
}

/**
 * The live engine state that holds a fresh URL Inspection, or null when the
 * reader may preview and approve one. The preview and the approval both ask
 * again, because gscdump can start inspecting after the report loads.
 */
export function firstReportHold(indexing: { status: IndexingStatus, reason: string | null }): FirstReportHold | null {
  const state = firstReportWithoutVerdicts(indexing)
  return state._tag === 'NoVerdicts' ? null : state
}

/** Indexed is the outcome the reader wants, so it is the only success. Every other verdict is a page Google did not index. */
export function verdictStatus(verdict: string | null): SemanticStatus {
  if (!verdict)
    return 'neutral'
  return verdict === 'PASS' ? 'success' : 'warning'
}

const reportDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

/** A stored timestamp as a calendar date, such as Nov 23, 2026. A value that is not a date stays as it is. */
export function formatReportDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : reportDate.format(date)
}

/**
 * The Site the report opens on. With several Sites, the first one whose URL
 * Inspection is ready most likely has saved verdicts, then one that gscdump
 * is inspecting now, then the first Site in the list.
 */
export function defaultReportSite<TSite extends { processing?: { indexing: IndexingStatus } | null }>(sites: readonly TSite[]): TSite | undefined {
  return sites.find(site => site.processing?.indexing === 'ready')
    ?? sites.find(site => site.processing?.indexing === 'checking')
    ?? sites[0]
}

export type FirstReportPreview
  = | { _tag: 'Ready', urls: string[], token: string, observedAt: string, canInspect: boolean }
    | { _tag: 'Empty' | 'Incomplete' }
    | FirstReportHold

export type FirstReportResult
  = | { _tag: 'Results', rows: ({ _tag: 'Evidence', evidence: PageEvidence } | { _tag: 'NoResult', url: string } | { _tag: 'Error' | 'Skipped', url: string, reason: string })[] }
    | FirstReportHold
    | { _tag: 'DailyQuota' }
    | { _tag: 'Refused', message: string }
    | { _tag: 'Uncertain' }
