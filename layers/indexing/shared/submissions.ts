// The Submissions page's pure core: receipts in, totals and outcomes out.
//
// gscdump has no summary or outcome operation yet (the design note
// `submission-value-design-2026-11-18` lists them as engine work). Until it
// ships, the page reads the newest receipts of each channel and the URL
// Inspection rows it already has, and these functions turn them into what the
// page shows. They count only what was read, and say when the read stopped
// inside the window, so a capped read never passes for a 30-day total.
//
// When `@nuxtseo/pro-indexing` ships its Submissions section, its Site card
// replaces `summarizeSubmissions` and its URL timeline replaces
// `resolveSubmissionOutcome`. Nothing else on the page depends on them.

import type { GoogleSubmissionReceiptV1, IndexNowAutomaticSendingV1, IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'

/** The window the Sent card counts. */
export const SUBMISSIONS_WINDOW_DAYS = 30
/** The most receipts one list read returns (the contract caps `limit` at 100). */
export const SUBMISSIONS_RECEIPT_READ_LIMIT = 100
/** How many of the latest URLs the Afterwards card reads a URL Inspection result for. */
export const SUBMISSIONS_OUTCOME_URL_LIMIT = 10
/** Rows one URL search reads. A search matches by substring, so the exact URL can sit among many. */
export const SUBMISSIONS_OUTCOME_SEARCH_LIMIT = 50

export type SubmissionChannel = 'indexnow' | 'google'
export type SubmissionTrigger = 'manual' | 'automatic'

/** What the search engine answered, grouped the same way for both channels. */
export type SubmissionAnswer = 'accepted' | 'waiting' | 'not-accepted'

/** The receipt state, kept per channel so the row can use that channel's own label. */
export type SubmissionReceiptState
  = | { channel: 'indexnow', tag: IndexNowSubmissionReceiptV1['_tag'] }
    | { channel: 'google', tag: GoogleSubmissionReceiptV1['_tag'] }

/** One URL in one Submission. */
export interface SentUrl {
  url: string
  sentAt: string
  answer: SubmissionAnswer
  receipt: SubmissionReceiptState
  trigger: SubmissionTrigger
}

export interface ChannelTotals {
  /** URL notifications sent. A URL sent twice counts twice. */
  urls: number
  accepted: number
  waiting: number
  notAccepted: number
  /** URLs that automatic sending chose. Always 0 for Google. */
  automatic: number
}

/** One page of a receipt list, as the engine returned it. */
export interface ReceiptPage<T> {
  receipts: readonly T[]
  hasMore: boolean
}

export interface SubmissionsSummary {
  indexnow: ChannelTotals
  google: ChannelTotals
  /**
   * A channel had more receipts than the read returned, and the oldest one read
   * is still inside the window. The counts are then a lower bound.
   */
  capped: boolean
  /** Every URL sent inside the window, newest first. */
  sent: SentUrl[]
}

const INDEXNOW_ANSWERS: Record<IndexNowSubmissionReceiptV1['_tag'], SubmissionAnswer> = {
  accepted: 'accepted',
  queued: 'waiting',
  pending: 'waiting',
  retrying: 'waiting',
  rejected: 'not-accepted',
  failed: 'not-accepted',
}

const GOOGLE_ANSWERS: Record<GoogleSubmissionReceiptV1['_tag'], SubmissionAnswer> = {
  accepted: 'accepted',
  rejected: 'not-accepted',
  failed: 'not-accepted',
}

function emptyTotals(): ChannelTotals {
  return { urls: 0, accepted: 0, waiting: 0, notAccepted: 0, automatic: 0 }
}

function addTo(totals: ChannelTotals, sent: SentUrl) {
  totals.urls++
  if (sent.answer === 'accepted')
    totals.accepted++
  else if (sent.answer === 'waiting')
    totals.waiting++
  else
    totals.notAccepted++
  if (sent.trigger === 'automatic')
    totals.automatic++
}

function readCapped(page: ReceiptPage<{ createdAt: string }>, windowStart: number): boolean {
  if (!page.hasMore)
    return false
  const oldest = page.receipts.at(-1)
  return !oldest || Date.parse(oldest.createdAt) >= windowStart
}

export function submissionsWindowStart(now: Date, windowDays = SUBMISSIONS_WINDOW_DAYS): number {
  return now.getTime() - windowDays * 24 * 60 * 60 * 1000
}

/**
 * Totals for each channel inside the window, and every URL sent in it.
 *
 * Reads the receipts as given. A receipt older than the window is left out; a
 * receipt the engine did not return is unknown, which `capped` reports.
 */
export function summarizeSubmissions(input: {
  indexnow: ReceiptPage<IndexNowSubmissionReceiptV1>
  google: ReceiptPage<GoogleSubmissionReceiptV1>
  now: Date
  windowDays?: number
}): SubmissionsSummary {
  const windowStart = submissionsWindowStart(input.now, input.windowDays)
  const inWindow = (createdAt: string) => Date.parse(createdAt) >= windowStart
  const indexnow = emptyTotals()
  const google = emptyTotals()
  const sent: SentUrl[] = []

  for (const receipt of input.indexnow.receipts) {
    if (!inWindow(receipt.createdAt))
      continue
    for (const url of receipt.urls) {
      const row: SentUrl = {
        url,
        sentAt: receipt.createdAt,
        answer: INDEXNOW_ANSWERS[receipt._tag],
        receipt: { channel: 'indexnow', tag: receipt._tag },
        trigger: receipt.trigger,
      }
      addTo(indexnow, row)
      sent.push(row)
    }
  }
  for (const receipt of input.google.receipts) {
    if (!inWindow(receipt.createdAt))
      continue
    const row: SentUrl = {
      url: receipt.url,
      sentAt: receipt.createdAt,
      answer: GOOGLE_ANSWERS[receipt._tag],
      receipt: { channel: 'google', tag: receipt._tag },
      trigger: 'manual',
    }
    addTo(google, row)
    sent.push(row)
  }

  sent.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
  return {
    indexnow,
    google,
    capped: readCapped(input.indexnow, windowStart) || readCapped(input.google, windowStart),
    sent,
  }
}

/**
 * The latest Submission of each distinct URL, newest first, at most `limit`.
 * `total` counts every distinct URL, so the page can say how many it left out.
 */
export function latestSentUrls(sent: readonly SentUrl[], limit = SUBMISSIONS_OUTCOME_URL_LIMIT): { rows: SentUrl[], total: number } {
  const seen = new Set<string>()
  const latest: SentUrl[] = []
  for (const row of [...sent].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))) {
    if (seen.has(row.url))
      continue
    seen.add(row.url)
    latest.push(row)
  }
  return { rows: latest.slice(0, limit), total: latest.length }
}

/** The fields of a URL Inspection row the outcome reads. */
export interface InspectionRow {
  url: string
  verdict: string | null
  coverageState: string | null
  lastCheckedAt: string
}

/**
 * One URL search result: its rows, and whether they are every match. The
 * engine proves `hasMore` with a lookahead row, so `complete` is `!hasMore`.
 */
export interface InspectionSearch {
  rows: readonly InspectionRow[]
  complete: boolean
}

/** The verdicts gscdump files under `status=not_indexed`. `PASS` is indexed; `null` is its `pending`. */
const NOT_INDEXED_VERDICTS: ReadonlySet<string> = new Set(['FAIL', 'PARTIAL', 'NEUTRAL'])

/**
 * Google's latest URL Inspection verdict for a URL, relative to one Submission.
 *
 * Order in time only: a verdict counts when Google inspected the URL after it
 * was sent, and says nothing about why.
 *
 * - `no-verdict`: inspected after it was sent, with no index verdict recorded.
 * - `no-result`: the search returned every match, and none is this URL.
 * - `not-read`: the search returned only part of its matches, without this URL.
 * - `read-failed`: the search for this URL failed.
 */
export type SubmissionOutcome
  = | { _tag: 'indexed', inspectedAt: string }
    | { _tag: 'not-indexed', inspectedAt: string, coverageState: string | null }
    | { _tag: 'no-verdict', inspectedAt: string }
    | { _tag: 'not-inspected-since', inspectedAt: string }
    | { _tag: 'no-result' }
    | { _tag: 'not-read' }
    | { _tag: 'read-failed' }

export function resolveSubmissionOutcome(sent: Pick<SentUrl, 'url' | 'sentAt'>, search: InspectionSearch): SubmissionOutcome {
  const row = search.rows.find(candidate => candidate.url === sent.url)
  if (!row)
    return search.complete ? { _tag: 'no-result' } : { _tag: 'not-read' }
  if (!(Date.parse(row.lastCheckedAt) > Date.parse(sent.sentAt)))
    return { _tag: 'not-inspected-since', inspectedAt: row.lastCheckedAt }
  if (row.verdict === 'PASS')
    return { _tag: 'indexed', inspectedAt: row.lastCheckedAt }
  if (row.verdict && NOT_INDEXED_VERDICTS.has(row.verdict))
    return { _tag: 'not-indexed', inspectedAt: row.lastCheckedAt, coverageState: row.coverageState }
  return { _tag: 'no-verdict', inspectedAt: row.lastCheckedAt }
}

/** The automatic sending state a reader sees, from the IndexNow connection. */
export type AutomaticSendingView
  = | { _tag: 'needs-key' }
    | { _tag: 'off' }
    | { _tag: 'waiting-for-key' }
    | { _tag: 'on', lastCheck: AutomaticSendingCheck | null }

export type AutomaticSendingCheck = NonNullable<Extract<IndexNowAutomaticSendingV1, { _tag: 'on' }>['lastCheck']>

export function viewAutomaticSending(connection: IndexNowConnectionV1): AutomaticSendingView {
  if (connection._tag === 'disconnected')
    return { _tag: 'needs-key' }
  const sending = connection.automaticSending
  if (sending._tag === 'off')
    return { _tag: 'off' }
  if (connection._tag === 'verification-required')
    return { _tag: 'waiting-for-key' }
  return { _tag: 'on', lastCheck: sending.lastCheck }
}

/**
 * Whether the verify action turns automatic sending on (gscdump.com ADR-0031,
 * section 2.3). Only when a key becomes verified with the switch off: a reader
 * who turned it off on a verified key keeps it off when they verify again.
 */
export function shouldTurnOnAutomaticSending(before: IndexNowConnectionV1 | null | undefined, after: IndexNowConnectionV1): boolean {
  return after._tag === 'connected'
    && after.automaticSending._tag === 'off'
    && before?._tag !== 'connected'
}
