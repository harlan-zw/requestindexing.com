// Request Indexing's interim Submissions reads, as the shared section
// (`@nuxtseo/pro-indexing/shared/submissions`) takes them.
//
// gscdump defines `getSiteSubmissionSummary` and `listSiteSubmissionOutcomes`
// in contracts 7.17.0, but gscdump.com does not serve them yet
// (gscdump.com#1233). Until it does, these build the same shapes from what it
// serves: both receipt lists, the IndexNow connection, and gscdump's saved URL
// Inspection results. When the operations ship, the capabilities read them and
// this file keeps only the automatic sending helpers at the bottom.
//
// Outcomes follow gscdump.com#1233 and gscdump#304: one row for each URL a
// search engine received (IndexNow HTTP 200 or 202, Google HTTP 200), anchored
// on the newest time an engine received it (`updatedAt`). Google's saved
// result counts only when Google inspected the URL after that. Order in time,
// never cause.

import type { GscdumpIndexingUrl } from '@gscdump/contracts'
import type { GoogleSubmissionReceiptV1, IndexNowAutomaticSendingV1, IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import type {
  IndexingAutomaticSending,
  IndexingGoogleAfterwards,
  IndexingReceiptState,
  IndexingSubmissionCompleteness,
  IndexingSubmissionEngine,
  IndexingSubmissionEngineTotals,
  IndexingSubmissionOutcome,
  IndexingSubmissionOutcomes,
  IndexingSubmissionOutcomesParams,
  IndexingSubmissionReason,
  IndexingSubmissionSend,
  IndexingSubmissionSummary,
} from '@nuxtseo/pro-indexing/shared/submissions'
import { SUBMISSION_WINDOW_DAYS } from '@nuxtseo/pro-indexing/shared/submissions'

const DAY_MS = 86_400_000

/** The engine's page cap on both receipt lists. */
export const RECEIPT_PAGE_SIZE = 100
/** Pages read per channel before the window counts as partial. gscdump admits 60 reads a minute per list. */
export const RECEIPT_PAGE_LIMIT = 5
/** Received URLs whose saved URL Inspection result the totals read, most recently received first. */
export const OUTCOME_LOOKUP_LIMIT = 10
/** Rows one URL search page reads. gscdump matches by substring, so a short URL can sit among many. */
export const URL_SEARCH_PAGE_SIZE = 100
/** Search pages read for one URL before its result counts as unknown. */
export const URL_SEARCH_PAGE_LIMIT = 3

/** The verdicts gscdump files under `status=not_indexed`. `PASS` is indexed; no verdict is its `pending`. */
const NOT_INDEXED_VERDICTS: ReadonlySet<string> = new Set(['FAIL', 'PARTIAL', 'NEUTRAL'])

/** The window start for `now`, an ISO date-time. */
export function submissionWindowStart(now: number): string {
  return new Date(now - SUBMISSION_WINDOW_DAYS * DAY_MS).toISOString()
}

/** One page of a receipt list, as the engine returns it, newest first. */
export interface ReceiptPage<T> {
  readonly receipts: readonly T[]
  readonly hasMore: boolean
}

/** One channel's receipts inside the window. `partial`: the read stopped at the page limit with more inside. */
export interface ChannelWindow<T> {
  readonly receipts: readonly T[]
  readonly partial: boolean
}

/**
 * Reads a receipt list, newest first, until a receipt predates `since`, the
 * list ends, or `RECEIPT_PAGE_LIMIT` pages.
 */
export async function readReceiptWindow<T extends { id: string, createdAt: string }>(
  fetchPage: (offset: number, limit: number) => Promise<ReceiptPage<T>>,
  since: string,
): Promise<ChannelWindow<T>> {
  const start = Date.parse(since)
  const receipts: T[] = []
  const seen = new Set<string>()
  for (let page = 0; page < RECEIPT_PAGE_LIMIT; page++) {
    const { receipts: rows, hasMore } = await fetchPage(page * RECEIPT_PAGE_SIZE, RECEIPT_PAGE_SIZE)
    const inWindow = rows.filter(receipt => Date.parse(receipt.createdAt) >= start)
    // A receipt created between page reads shifts the offsets, so one can
    // appear on two pages. Keep the first copy.
    for (const receipt of inWindow) {
      if (!seen.has(receipt.id)) {
        seen.add(receipt.id)
        receipts.push(receipt)
      }
    }
    if (!hasMore || inWindow.length < rows.length)
      return { receipts, partial: false }
  }
  return { receipts, partial: true }
}

/** Everything one Site's Submissions reads need, read once per Site. */
export interface SubmissionWindow {
  readonly since: string
  readonly indexNow: readonly IndexNowSubmissionReceiptV1[]
  readonly google: readonly GoogleSubmissionReceiptV1[]
  readonly completeness: IndexingSubmissionCompleteness
  /** False when Request Indexing has no Google Indexing API access, so the Site cannot send to Google. */
  readonly googleAvailable: boolean
  readonly automaticSending: IndexingAutomaticSending | null
}

export function windowCompleteness(indexNow: ChannelWindow<unknown>, google: ChannelWindow<unknown>): IndexingSubmissionCompleteness {
  return indexNow.partial || google.partial
    ? { _tag: 'partial', receipts: indexNow.receipts.length + google.receipts.length }
    : { _tag: 'complete' }
}

/** The IndexNow connection's Automatic sending, or null without a key. */
export function automaticSendingOf(connection: IndexNowConnectionV1): IndexingAutomaticSending | null {
  if (connection._tag === 'disconnected')
    return null
  const state = connection.automaticSending
  if (state._tag === 'off')
    return { _tag: 'off' }
  return { _tag: connection._tag === 'connected' ? 'on' : 'key-unverified', since: state.since, lastCheck: state.lastCheck }
}

/** HTTP 202 (key validation pending) is in progress, not accepted. */
function indexNowState(receipt: Pick<IndexNowSubmissionReceiptV1, '_tag'>): IndexingReceiptState {
  switch (receipt._tag) {
    case 'accepted':
      return 'accepted'
    case 'rejected':
    case 'failed':
      return 'failed'
    case 'queued':
    case 'pending':
    case 'retrying':
      return 'in-progress'
  }
}

function googleState(receipt: Pick<GoogleSubmissionReceiptV1, '_tag'>): IndexingReceiptState {
  return receipt._tag === 'accepted' ? 'accepted' : 'failed'
}

/**
 * A URL's identity, as gscdump keys it (`URL.href`): `/docs` and `/docs/` stay
 * two URLs. Only the `{ url }` filter folds a trailing slash.
 */
export function urlKey(url: string): string {
  return URL.parse(url)?.href ?? url
}

/** A URL without its fragment, or a trailing slash on a non-root path, for the `{ url }` filter only. */
export function urlMatchKey(url: string): string {
  const parsed = URL.parse(url)
  if (!parsed)
    return url
  const path = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/$/, '')
  return `${parsed.origin}${path}${parsed.search}`
}

/** One URL in one Submission, with the time an engine received it when it did. */
interface UrlSend {
  readonly url: string
  readonly send: IndexingSubmissionSend
  readonly receivedAt: string | null
}

function urlSends(window: SubmissionWindow): UrlSend[] {
  const sends: UrlSend[] = []
  for (const receipt of window.indexNow) {
    // HTTP 202 means IndexNow received the URLs while it still checks the key.
    const received = receipt._tag === 'accepted' || receipt._tag === 'pending'
    for (const url of new Set(receipt.urls))
      sends.push({ url, send: { engine: 'indexnow', trigger: receipt.trigger, state: indexNowState(receipt), sentAt: receipt.createdAt }, receivedAt: received ? receipt.updatedAt : null })
  }
  for (const receipt of window.google)
    sends.push({ url: receipt.url, send: { engine: 'google', trigger: 'manual', state: googleState(receipt), sentAt: receipt.createdAt }, receivedAt: receipt._tag === 'accepted' ? receipt.updatedAt : null })
  return sends
}

const byTime = (a: string, b: string) => Date.parse(a) - Date.parse(b)

/** The `submissions` read: distinct URLs per engine, each by its latest Submission Receipt. */
export function summarizeSubmissionWindow(window: SubmissionWindow): IndexingSubmissionSummary {
  const latest = new Map<string, IndexingSubmissionSend>()
  for (const { url, send } of urlSends(window)) {
    const key = `${send.engine} ${urlKey(url)}`
    const current = latest.get(key)
    if (!current || byTime(send.sentAt, current.sentAt) > 0)
      latest.set(key, send)
  }
  // Google is listed only when the Site can send to it, never at zero for an
  // engine it cannot reach. Receipts prove it could, whatever access says now.
  const engines: IndexingSubmissionEngine[] = window.googleAvailable || window.google.length > 0 ? ['indexnow', 'google'] : ['indexnow']
  return {
    since: window.since,
    days: SUBMISSION_WINDOW_DAYS,
    engines: engines.map((engine): IndexingSubmissionEngineTotals => {
      const totals = { engine, urls: 0, accepted: 0, inProgress: 0, failed: 0, manual: 0, automatic: 0 }
      for (const send of latest.values()) {
        if (send.engine !== engine)
          continue
        totals.urls++
        totals[send.state === 'accepted' ? 'accepted' : send.state === 'failed' ? 'failed' : 'inProgress']++
        totals[send.trigger]++
      }
      return totals
    }),
    automaticSending: window.automaticSending,
    completeness: window.completeness,
  }
}

/** A URL a search engine received in the window. */
export interface ReceivedUrl {
  readonly url: string
  /** Every Submission of the URL in the window, oldest first, received or not. */
  readonly sends: readonly IndexingSubmissionSend[]
  /** When an engine last received it. Google's result counts only after this. */
  readonly receivedAt: string
}

/** The URLs a search engine received in the window, most recently received first. */
export function receivedUrls(window: SubmissionWindow): ReceivedUrl[] {
  const byUrl = new Map<string, { url: string, sends: IndexingSubmissionSend[], receivedAt: string | null }>()
  for (const { url, send, receivedAt } of urlSends(window)) {
    const key = urlKey(url)
    const entry = byUrl.get(key) ?? { url, sends: [], receivedAt: null }
    entry.sends.push(send)
    if (receivedAt && (!entry.receivedAt || byTime(receivedAt, entry.receivedAt) > 0))
      entry.receivedAt = receivedAt
    byUrl.set(key, entry)
  }
  const received: ReceivedUrl[] = []
  for (const entry of byUrl.values()) {
    if (entry.receivedAt)
      received.push({ url: entry.url, sends: entry.sends.sort((a, b) => byTime(a.sentAt, b.sentAt)), receivedAt: entry.receivedAt })
  }
  return received.sort((a, b) => byTime(b.receivedAt, a.receivedAt))
}

/**
 * A short stable digest of the received URLs and their times. The outcome
 * reads key on it, so a refreshed window with the same Submissions reuses
 * their searches.
 */
export function receivedFingerprint(window: SubmissionWindow): string {
  let hash = 0x811C9DC5
  for (const entry of receivedUrls(window)) {
    for (const char of `${entry.url}@${entry.receivedAt}|`) {
      hash ^= char.charCodeAt(0)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash.toString(16)
}

/** The fields of a saved URL Inspection row the outcome reads. */
export type InspectionRow = Pick<GscdumpIndexingUrl, 'url' | 'verdict' | 'coverageState' | 'lastCrawlTime' | 'lastCheckedAt'>

/**
 * What a URL search found. `absent`: the search returned every match and none
 * is this URL. `unknown`: it stopped before the end, or failed, with no row
 * for this URL.
 */
export type UrlLookup
  = | { readonly _tag: 'found', readonly row: InspectionRow }
    | { readonly _tag: 'absent' }
    | { readonly _tag: 'unknown' }

/**
 * The term a URL search sends: the URL as the receipt holds it, without one
 * trailing slash, so `/docs` and `/docs/` both match. gscdump's `LIKE` is
 * literal, so no other part of the URL is rewritten.
 */
export function searchTerm(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

const newest = (rows: readonly InspectionRow[]) => rows.reduce((best, row) => byTime(row.lastCheckedAt, best.lastCheckedAt) > 0 ? row : best)

/** The rows that are this exact URL, as gscdump keys it. */
export function exactRows(url: string, rows: readonly InspectionRow[]): InspectionRow[] {
  const key = urlKey(url)
  return rows.filter(row => urlKey(row.url) === key)
}

/**
 * The row for `url` among the rows a search returned. The exact URL wins; its
 * other trailing slash form counts only without one. With several, the newest
 * check wins.
 */
export function lookupFromSearch(url: string, rows: readonly InspectionRow[], complete: boolean): UrlLookup {
  const exact = exactRows(url, rows)
  if (exact.length)
    return { _tag: 'found', row: newest(exact) }
  const folded = rows.filter(row => urlMatchKey(row.url) === urlMatchKey(url))
  if (folded.length)
    return { _tag: 'found', row: newest(folded) }
  return complete ? { _tag: 'absent' } : { _tag: 'unknown' }
}

/**
 * Google's saved result for a received URL. `null` leaves the URL out of the
 * totals: its search could not tell, or Google recorded no index verdict.
 */
export function googleAfterwards(receivedAt: string, lookup: UrlLookup): IndexingGoogleAfterwards | null {
  if (lookup._tag === 'unknown')
    return null
  if (lookup._tag === 'absent')
    return { _tag: 'not-inspected' }
  const { row } = lookup
  if (!(Date.parse(row.lastCheckedAt) > Date.parse(receivedAt)))
    return { _tag: 'not-inspected' }
  if (row.verdict === 'PASS')
    return { _tag: 'indexed', checkedAt: row.lastCheckedAt, crawledAt: row.lastCrawlTime }
  if (row.verdict && NOT_INDEXED_VERDICTS.has(row.verdict))
    return { _tag: 'not-indexed', checkedAt: row.lastCheckedAt, crawledAt: row.lastCrawlTime, reason: row.coverageState }
  return null
}

/** The received URLs a `submissionOutcomes` read covers, and the ones it looks up. */
export function outcomeCandidates(window: SubmissionWindow, params: IndexingSubmissionOutcomesParams): { matching: ReceivedUrl[], looked: ReceivedUrl[] } {
  const wanted = params.url === undefined ? null : urlMatchKey(params.url)
  const matching = receivedUrls(window).filter(entry => wanted === null || urlMatchKey(entry.url) === wanted)
  return { matching, looked: matching.slice(0, OUTCOME_LOOKUP_LIMIT) }
}

/**
 * The `submissionOutcomes` read from the looked-up URLs and their search
 * results, in the same order. A URL with no usable result is left out, so
 * `checked` falls below `sent` and the card says how many URLs it covers.
 */
export function buildSubmissionOutcomes(
  window: SubmissionWindow,
  params: IndexingSubmissionOutcomesParams,
  matching: readonly ReceivedUrl[],
  looked: readonly ReceivedUrl[],
  lookups: readonly UrlLookup[],
): IndexingSubmissionOutcomes {
  const outcomes: IndexingSubmissionOutcome[] = looked.flatMap((entry, index) => {
    const afterwards = googleAfterwards(entry.receivedAt, lookups[index] ?? { _tag: 'unknown' })
    return afterwards ? [{ url: entry.url, sends: entry.sends, afterwards }] : []
  })
  const reasons = new Map<string, number>()
  let indexed = 0
  let notIndexed = 0
  let notInspected = 0
  for (const { afterwards } of outcomes) {
    if (afterwards._tag === 'indexed') {
      indexed++
    }
    else if (afterwards._tag === 'not-indexed') {
      notIndexed++
      if (afterwards.reason)
        reasons.set(afterwards.reason, (reasons.get(afterwards.reason) ?? 0) + 1)
    }
    else {
      notInspected++
    }
  }
  const offset = params.offset ?? 0
  const limit = params.limit ?? outcomes.length
  return {
    since: window.since,
    days: SUBMISSION_WINDOW_DAYS,
    sent: matching.length,
    checked: outcomes.length,
    indexed,
    notIndexed,
    notInspected,
    reasons: Array.from(reasons, ([reason, urls]): IndexingSubmissionReason => ({ reason, urls })).sort((a, b) => b.urls - a.urls),
    outcomes: outcomes.slice(offset, offset + limit),
  }
}

// ── Automatic sending, for the IndexNow page's switch ──

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
