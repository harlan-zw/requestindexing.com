import type { GoogleSubmissionReceiptV1, IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import type { SubmissionWindow, UrlLookup } from './submissions'
import { describe, expect, it } from 'vitest'
import {
  buildSubmissionOutcomes,
  googleAfterwards,
  lookupFromSearch,
  outcomeCandidates,
  readReceiptWindow,
  RECEIPT_PAGE_LIMIT,
  receivedFingerprint,
  receivedUrls,
  searchTerm,
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

describe('receivedUrls', () => {
  it('keeps the URLs an engine received, anchored on the newest time it received them', () => {
    const received = receivedUrls(window({
      indexNow: [
        indexNow('in_3', 'failed', '2026-11-17T12:00:00.000Z', ['https://a.test/1']),
        indexNow('in_2', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1'], 'manual', '2026-11-15T12:05:00.000Z'),
        indexNow('in_1', 'rejected', '2026-11-14T12:00:00.000Z', ['https://a.test/never']),
      ],
      google: [google('g_1', 'accepted', '2026-11-10T12:00:00.000Z', 'https://a.test/1', '2026-11-10T12:01:00.000Z')],
    }))
    expect(received.map(entry => [entry.url, entry.receivedAt, entry.sends.length])).toEqual([
      ['https://a.test/1', '2026-11-15T12:05:00.000Z', 3],
    ])
  })

  it('counts an IndexNow HTTP 202 as received, as gscdump does', () => {
    const received = receivedUrls(window({ indexNow: [indexNow('in_1', 'pending', '2026-11-15T12:00:00.000Z', ['https://a.test/new'], 'manual', '2026-11-15T12:01:00.000Z')] }))
    expect(received.map(entry => [entry.url, entry.receivedAt])).toEqual([['https://a.test/new', '2026-11-15T12:01:00.000Z']])
  })

  it('keeps /docs and /docs/ apart, the same in the summary and the outcomes', () => {
    const current = window({ indexNow: [indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/docs', 'https://a.test/docs/'])] })
    expect(receivedUrls(current)).toHaveLength(2)
    expect(summarizeSubmissionWindow(current).engines[0]!.urls).toBe(2)
  })
})

describe('receivedFingerprint', () => {
  it('stays the same for the same received URLs and moves when one is received again', () => {
    const before = window({ indexNow: [indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1'])] })
    expect(receivedFingerprint({ ...before, since: '2026-10-20T12:00:00.000Z' })).toBe(receivedFingerprint(before))
    const after = window({ indexNow: [indexNow('in_2', 'accepted', '2026-11-16T12:00:00.000Z', ['https://a.test/1']), ...before.indexNow] })
    expect(receivedFingerprint(after)).not.toBe(receivedFingerprint(before))
  })
})

describe('googleAfterwards', () => {
  const receivedAt = '2026-11-10T12:00:00.000Z'

  it('counts a verdict only from a check after an engine received the URL', () => {
    expect(googleAfterwards(receivedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', 'PASS') })).toMatchObject({ _tag: 'indexed' })
    expect(googleAfterwards(receivedAt, { _tag: 'found', row: row('u', '2026-11-09T12:00:00.000Z', 'PASS') })).toEqual({ _tag: 'not-inspected' })
  })

  it('files PARTIAL as not indexed, with Google\'s own reason', () => {
    expect(googleAfterwards(receivedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', 'PARTIAL', 'Crawled - currently not indexed') }))
      .toMatchObject({ _tag: 'not-indexed', reason: 'Crawled - currently not indexed' })
  })

  it('leaves out a check with no verdict and a search that could not tell', () => {
    expect(googleAfterwards(receivedAt, { _tag: 'found', row: row('u', '2026-11-12T12:00:00.000Z', null) })).toBeNull()
    expect(googleAfterwards(receivedAt, { _tag: 'unknown' })).toBeNull()
    expect(googleAfterwards(receivedAt, { _tag: 'absent' })).toEqual({ _tag: 'not-inspected' })
  })
})

describe('lookupFromSearch', () => {
  it('takes the exact URL over its other trailing slash form', () => {
    // gscdump sorts not-indexed rows first, so the redirecting form comes back first.
    const rows = [row('https://a.test/docs', '2026-11-12T12:00:00.000Z', 'NEUTRAL', 'Page with redirect'), row('https://a.test/docs/', '2026-11-11T12:00:00.000Z', 'PASS')]
    expect(lookupFromSearch('https://a.test/docs/', rows, true)).toEqual({ _tag: 'found', row: rows[1] })
  })

  it('matches both forms of the Site root', () => {
    const root = row('https://a.test', 'x', 'PASS')
    expect(lookupFromSearch('https://a.test/', [root], true)).toEqual({ _tag: 'found', row: root })
  })

  it('keeps non-root slash forms separate and ignores longer URLs', () => {
    expect(lookupFromSearch('https://a.test/docs/', [row('https://a.test/docs', 'x', 'PASS')], true)).toEqual({ _tag: 'absent' })
    expect(lookupFromSearch('https://a.test/docs', [row('https://a.test/docs-2', 'x', 'PASS')], true)).toEqual({ _tag: 'absent' })
    expect(lookupFromSearch('https://a.test/docs', [row('https://a.test/docs-2', 'x', 'PASS')], false)).toEqual({ _tag: 'unknown' })
  })
})

describe('searchTerm', () => {
  it('drops one trailing slash and rewrites nothing else', () => {
    expect(searchTerm('https://A.test/Docs/')).toBe('https://A.test/Docs')
    expect(searchTerm('https://a.test/p/?q=1')).toBe('https://a.test/p/?q=1')
  })
})

describe('buildSubmissionOutcomes', () => {
  const current = window({
    indexNow: [indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/1', 'https://a.test/2', 'https://a.test/3'])],
  })

  it('totals Google\'s results and says how many received URLs they cover', () => {
    const { matching, looked } = outcomeCandidates(current, { limit: 0 })
    const lookups: UrlLookup[] = looked.map(entry => entry.url.endsWith('1')
      ? { _tag: 'found', row: row(entry.url, '2026-11-16T12:00:00.000Z', 'NEUTRAL', 'Crawled - currently not indexed') }
      : entry.url.endsWith('2') ? { _tag: 'found', row: row(entry.url, '2026-11-16T12:00:00.000Z', null) } : { _tag: 'absent' })
    const outcomes = buildSubmissionOutcomes(current, { limit: 0 }, matching, looked, lookups)
    expect(outcomes).toMatchObject({ sent: 3, checked: 2, indexed: 0, notIndexed: 1, notInspected: 1, outcomes: [] })
    expect(outcomes.reasons).toEqual([{ reason: 'Crawled - currently not indexed', urls: 1 }])
  })

  it('looks up nothing for a URL no engine received', () => {
    expect(outcomeCandidates(current, { url: 'https://a.test/never' })).toEqual({ matching: [], looked: [] })
  })

  it('reads only the exact URL when an engine received both trailing slash forms', () => {
    const both = window({ indexNow: [
      indexNow('in_2', 'accepted', '2026-11-16T12:00:00.000Z', ['https://a.test/docs']),
      indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/docs/']),
    ] })
    expect(outcomeCandidates(both, { url: 'https://a.test/docs/' }).matching.map(entry => entry.url)).toEqual(['https://a.test/docs/'])
    expect(outcomeCandidates(both, { url: 'https://a.test/docs' }).matching.map(entry => entry.url)).toEqual(['https://a.test/docs'])
  })

  it('reads the other trailing slash form when an engine received only that one', () => {
    const one = window({ indexNow: [indexNow('in_1', 'accepted', '2026-11-15T12:00:00.000Z', ['https://a.test/docs/'])] })
    expect(outcomeCandidates(one, { url: 'https://a.test/docs' }).matching.map(entry => entry.url)).toEqual(['https://a.test/docs/'])
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
