import type { GoogleSubmissionReceiptV1, IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import type { SubmissionWindow, UrlLookup } from './submissions'
import { describe, expect, it } from 'vitest'
import {
  acceptedUrls,
  buildSubmissionOutcomes,
  googleAfterwards,
  lookupFromSearch,
  outcomeCandidates,
  readReceiptWindow,
  RECEIPT_PAGE_LIMIT,
  shouldTurnOnAutomaticSending,
  summarizeSubmissionWindow,
  viewAutomaticSending,
} from './submissions'
import { describeAutomaticSending } from './submissions-copy'

const SINCE = '2026-10-19T12:00:00.000Z'

function indexNow(id: string, tag: IndexNowSubmissionReceiptV1['_tag'], createdAt: string, urls: string[], trigger: 'manual' | 'automatic' = 'manual', updatedAt = createdAt): IndexNowSubmissionReceiptV1 {
  return { _tag: tag, id, createdAt, updatedAt, urls, trigger, reason: null, retryAt: null } as unknown as IndexNowSubmissionReceiptV1
}

function google(id: string, tag: GoogleSubmissionReceiptV1['_tag'], createdAt: string, url: string, updatedAt = createdAt): GoogleSubmissionReceiptV1 {
  return { _tag: tag, id, createdAt, updatedAt, url } as unknown as GoogleSubmissionReceiptV1
}

function window(overrides: Partial<SubmissionWindow> = {}): SubmissionWindow {
  return { since: SINCE, indexNow: [], google: [], completeness: { _tag: 'complete' }, googleAvailable: true, automaticSending: null, ...overrides }
}

const row = (url: string, lastCheckedAt: string, verdict: string | null, coverageState: string | null = null) => ({ url, verdict, coverageState, lastCrawlTime: null, lastCheckedAt })

describe('readReceiptWindow', () => {
  it('stops at the first page that reaches past the window, keeping only receipts inside it', async () => {
    const pages = [
      { receipts: [{ id: 'a', createdAt: '2026-11-17T12:00:00.000Z' }, { id: 'b', createdAt: '2026-10-01T12:00:00.000Z' }], hasMore: true },
    ]
    const read = await readReceiptWindow(async offset => pages[offset / 100]!, SINCE)
    expect(read).toEqual({ receipts: [{ id: 'a', createdAt: '2026-11-17T12:00:00.000Z' }], partial: false })
  })

  it('reports a partial window when the page limit comes before the window start', async () => {
    let calls = 0
    const read = await readReceiptWindow(async (offset) => {
      calls++
      return { receipts: [{ id: `r${offset}`, createdAt: '2026-11-17T12:00:00.000Z' }], hasMore: true }
    }, SINCE)
    expect(calls).toBe(RECEIPT_PAGE_LIMIT)
    expect(read.partial).toBe(true)
  })

  it('keeps one copy of a receipt that shifted onto the next page', async () => {
    const pages = [
      { receipts: [{ id: 'a', createdAt: '2026-11-17T12:00:00.000Z' }], hasMore: true },
      { receipts: [{ id: 'a', createdAt: '2026-11-17T12:00:00.000Z' }, { id: 'b', createdAt: '2026-11-16T12:00:00.000Z' }], hasMore: false },
    ]
    const read = await readReceiptWindow(async offset => pages[offset / 100]!, SINCE)
    expect(read.receipts.map(receipt => receipt.id)).toEqual(['a', 'b'])
  })
})

describe('summarizeSubmissionWindow', () => {
  it('counts each URL once per engine, by its latest receipt', () => {
    const summary = summarizeSubmissionWindow(window({
      indexNow: [
        indexNow('in_2', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1', 'https://a.test/2'], 'automatic'),
        indexNow('in_1', 'failed', '2026-11-01T12:00:00.000Z', ['https://a.test/1']),
        indexNow('in_0', 'pending', '2026-11-14T12:00:00.000Z', ['https://a.test/3']),
      ],
      google: [
        google('g_1', 'accepted', '2026-11-10T12:00:00.000Z', 'https://a.test/job'),
        google('g_0', 'rejected', '2026-11-05T12:00:00.000Z', 'https://a.test/job-2'),
      ],
    }))
    expect(summary.engines).toEqual([
      { engine: 'indexnow', urls: 3, accepted: 2, inProgress: 1, failed: 0, manual: 1, automatic: 2 },
      { engine: 'google', urls: 2, accepted: 1, inProgress: 0, failed: 1, manual: 2, automatic: 0 },
    ])
  })

  it('leaves Google out when the Site cannot send to it and never did', () => {
    expect(summarizeSubmissionWindow(window({ googleAvailable: false })).engines.map(engine => engine.engine)).toEqual(['indexnow'])
    expect(summarizeSubmissionWindow(window({ googleAvailable: false, google: [google('g', 'accepted', '2026-11-10T12:00:00.000Z', 'https://a.test/j')] })).engines.map(engine => engine.engine)).toEqual(['indexnow', 'google'])
  })
})

describe('acceptedUrls', () => {
  it('keeps only URLs an engine accepted, anchored on the newest acceptance time', () => {
    const accepted = acceptedUrls(window({
      indexNow: [
        indexNow('in_3', 'failed', '2026-11-17T12:00:00.000Z', ['https://a.test/1']),
        indexNow('in_2', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1/'], 'manual', '2026-11-15T12:05:00.000Z'),
        indexNow('in_1', 'rejected', '2026-11-14T12:00:00.000Z', ['https://a.test/never']),
      ],
      google: [google('g_1', 'accepted', '2026-11-10T12:00:00.000Z', 'https://a.test/1', '2026-11-10T12:01:00.000Z')],
    }))
    expect(accepted.map(entry => [entry.url, entry.acceptedAt, entry.sends.length])).toEqual([
      ['https://a.test/1', '2026-11-15T12:05:00.000Z', 3],
    ])
  })
})

describe('googleAfterwards', () => {
  const acceptedAt = '2026-11-10T12:00:00.000Z'

  it('counts a verdict only from a check after the engine accepted the URL', () => {
    expect(googleAfterwards(acceptedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', 'PASS') })).toMatchObject({ _tag: 'indexed' })
    expect(googleAfterwards(acceptedAt, { _tag: 'found', row: row('u', '2026-11-09T12:00:00.000Z', 'PASS') })).toEqual({ _tag: 'not-inspected' })
  })

  it('files PARTIAL as not indexed, with Google\'s own reason', () => {
    expect(googleAfterwards(acceptedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', 'PARTIAL', 'Crawled - currently not indexed') }))
      .toMatchObject({ _tag: 'not-indexed', reason: 'Crawled - currently not indexed' })
  })

  it('leaves out a check with no verdict and a search that could not tell', () => {
    expect(googleAfterwards(acceptedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', null) })).toBeNull()
    expect(googleAfterwards(acceptedAt, { _tag: 'unknown' })).toBeNull()
    expect(googleAfterwards(acceptedAt, { _tag: 'absent' })).toEqual({ _tag: 'not-inspected' })
  })
})

describe('lookupFromSearch', () => {
  it('matches across a trailing slash and never takes a longer URL', () => {
    expect(lookupFromSearch('https://a.test/docs/', [row('https://a.test/docs', 'x', 'PASS')], false)).toMatchObject({ _tag: 'found' })
    expect(lookupFromSearch('https://a.test/docs', [row('https://a.test/docs-2', 'x', 'PASS')], false)).toEqual({ _tag: 'absent' })
    expect(lookupFromSearch('https://a.test/docs', [row('https://a.test/docs-2', 'x', 'PASS')], true)).toEqual({ _tag: 'unknown' })
  })
})

describe('buildSubmissionOutcomes', () => {
  const current = window({
    indexNow: [indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1', 'https://a.test/2', 'https://a.test/3'])],
  })

  it('totals Google\'s results and says how many accepted URLs they cover', () => {
    const { matching, looked } = outcomeCandidates(current, { limit: 0 })
    const lookups: UrlLookup[] = looked.map(entry => entry.url.endsWith('1')
      ? { _tag: 'found', row: row(entry.url, '2026-11-16T12:00:00.000Z', 'NEUTRAL', 'Crawled - currently not indexed') }
      : entry.url.endsWith('2') ? { _tag: 'found', row: row(entry.url, '2026-11-16T12:00:00.000Z', null) } : { _tag: 'absent' })
    const outcomes = buildSubmissionOutcomes(current, { limit: 0 }, matching, looked, lookups)
    expect(outcomes).toMatchObject({ sent: 3, checked: 2, indexed: 0, notIndexed: 1, notInspected: 1, outcomes: [] })
    expect(outcomes.reasons).toEqual([{ reason: 'Crawled - currently not indexed', urls: 1 }])
  })

  it('looks up nothing for a URL with no accepted Submission', () => {
    expect(outcomeCandidates(current, { url: 'https://a.test/never' })).toEqual({ matching: [], looked: [] })
  })
})

describe('automatic sending', () => {
  const on = { _tag: 'on', since: '2026-11-18T12:00:00.000Z', lastCheck: null } as const
  const connected = (automaticSending: unknown) => ({ _tag: 'connected', host: 'a.test', keyLocation: 'https://a.test/k.txt', verifiedAt: '2026-11-18T12:00:00.000Z', automaticSending }) as IndexNowConnectionV1
  const pending = (automaticSending: unknown) => ({ _tag: 'verification-required', host: 'a.test', keyLocation: 'https://a.test/k.txt', reason: null, automaticSending }) as IndexNowConnectionV1

  it('turns on when a key becomes verified with the switch off', () => {
    expect(shouldTurnOnAutomaticSending(pending({ _tag: 'off' }), connected({ _tag: 'off' }))).toBe(true)
  })

  it('leaves a reader\'s off switch alone when an already verified key is verified again', () => {
    expect(shouldTurnOnAutomaticSending(connected({ _tag: 'off' }), connected({ _tag: 'off' }))).toBe(false)
  })

  it('does nothing when the switch is already on or the key failed', () => {
    expect(shouldTurnOnAutomaticSending(pending({ _tag: 'off' }), connected(on))).toBe(false)
    expect(shouldTurnOnAutomaticSending(pending({ _tag: 'off' }), pending({ _tag: 'off' }))).toBe(false)
  })

  it('describes the last check and why changed URLs were left unsent', () => {
    const view = viewAutomaticSending(connected({
      ...on,
      lastCheck: { checkedAt: '2026-11-18T12:00:00.000Z', changedUrls: 620, sentUrls: 500, completeness: { _tag: 'truncated', reasons: ['daily-limit'] } },
    }))
    expect(describeAutomaticSending(view)).toEqual([
      'Last check Nov 18, 2026: 620 changed URLs found, 500 sent.',
      'Some changed URLs were not sent, because this Site reached its daily limit for automatic sending. They do not wait for the next check.',
    ])
  })

  it('says sending waits for the key while the switch is on before verification', () => {
    expect(describeAutomaticSending(viewAutomaticSending(pending(on)))).toEqual(['Automatic sending is on. It starts after your key is verified.'])
  })

  it('asks for a key before the switch exists', () => {
    expect(describeAutomaticSending(viewAutomaticSending({ _tag: 'disconnected', host: 'a.test' }))).toEqual(['Save your IndexNow key before you turn on automatic sending.'])
  })
})
