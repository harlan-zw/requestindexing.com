import type { GoogleSubmissionReceiptV1, IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import { describe, expect, it } from 'vitest'
import {
  latestSentUrls,
  resolveSubmissionOutcome,
  shouldTurnOnAutomaticSending,
  summarizeSubmissions,
  viewAutomaticSending,
} from './submissions'
import { describeAutomaticSending } from './submissions-copy'

const NOW = new Date('2026-11-18T12:00:00.000Z')

function indexNow(tag: IndexNowSubmissionReceiptV1['_tag'], createdAt: string, urls: string[], trigger: 'manual' | 'automatic' = 'manual'): IndexNowSubmissionReceiptV1 {
  return { _tag: tag, id: `in_${createdAt}`, createdAt, urls, trigger, reason: null, retryAt: null } as unknown as IndexNowSubmissionReceiptV1
}

function google(tag: GoogleSubmissionReceiptV1['_tag'], createdAt: string, url: string): GoogleSubmissionReceiptV1 {
  return { _tag: tag, id: `g_${createdAt}`, createdAt, url } as unknown as GoogleSubmissionReceiptV1
}

describe('summarizeSubmissions', () => {
  it('counts URL notifications per channel inside the window and splits automatic ones', () => {
    const summary = summarizeSubmissions({
      indexnow: {
        receipts: [
          indexNow('accepted', '2026-11-17T12:00:00.000Z', ['https://a.test/1', 'https://a.test/2'], 'automatic'),
          indexNow('pending', '2026-11-16T12:00:00.000Z', ['https://a.test/3']),
          indexNow('failed', '2026-11-15T12:00:00.000Z', ['https://a.test/4']),
          indexNow('accepted', '2026-09-01T12:00:00.000Z', ['https://a.test/old']),
        ],
        hasMore: false,
      },
      google: {
        receipts: [
          google('accepted', '2026-11-14T12:00:00.000Z', 'https://a.test/job'),
          google('rejected', '2026-11-13T12:00:00.000Z', 'https://a.test/job-2'),
        ],
        hasMore: false,
      },
      now: NOW,
    })

    expect(summary.indexnow).toEqual({ urls: 4, accepted: 2, waiting: 1, notAccepted: 1, automatic: 2 })
    expect(summary.google).toEqual({ urls: 2, accepted: 1, waiting: 0, notAccepted: 1, automatic: 0 })
    expect(summary.capped).toBe(false)
    expect(summary.sent.map(row => row.url)).toEqual([
      'https://a.test/1',
      'https://a.test/2',
      'https://a.test/3',
      'https://a.test/4',
      'https://a.test/job',
      'https://a.test/job-2',
    ])
  })

  it('reports a capped read when the oldest receipt read is still inside the window', () => {
    const page = { receipts: [google('accepted', '2026-11-10T12:00:00.000Z', 'https://a.test/x')], hasMore: true }
    expect(summarizeSubmissions({ indexnow: { receipts: [], hasMore: false }, google: page, now: NOW }).capped).toBe(true)
  })

  it('does not report a cap when the read already reached past the window', () => {
    const page = { receipts: [google('accepted', '2026-10-01T12:00:00.000Z', 'https://a.test/x')], hasMore: true }
    expect(summarizeSubmissions({ indexnow: { receipts: [], hasMore: false }, google: page, now: NOW }).capped).toBe(false)
  })
})

describe('latestSentUrls', () => {
  it('keeps the newest Submission of each URL and counts every distinct URL', () => {
    const { sent } = summarizeSubmissions({
      indexnow: { receipts: [indexNow('accepted', '2026-11-17T12:00:00.000Z', ['https://a.test/1', 'https://a.test/2'])], hasMore: false },
      google: { receipts: [google('rejected', '2026-11-10T12:00:00.000Z', 'https://a.test/1')], hasMore: false },
      now: NOW,
    })

    const latest = latestSentUrls(sent, 1)
    expect(latest.total).toBe(2)
    expect(latest.rows).toHaveLength(1)
    expect(latest.rows[0]).toMatchObject({ url: 'https://a.test/1', receipt: { channel: 'indexnow', tag: 'accepted' } })
  })
})

describe('resolveSubmissionOutcome', () => {
  const sent = { url: 'https://a.test/page', sentAt: '2026-11-10T12:00:00.000Z' }
  const row = (lastCheckedAt: string, verdict: string | null, coverageState: string | null = null) => ({ url: sent.url, verdict, coverageState, lastCheckedAt })

  it('reports indexed only for a PASS inspected after the Submission', () => {
    expect(resolveSubmissionOutcome(sent, { rows: [row('2026-11-12T12:00:00.000Z', 'PASS')], complete: true }))
      .toEqual({ _tag: 'indexed', inspectedAt: '2026-11-12T12:00:00.000Z' })
  })

  it('carries Google\'s coverage state for a later verdict that is not indexed', () => {
    expect(resolveSubmissionOutcome(sent, { rows: [row('2026-11-12T12:00:00.000Z', 'NEUTRAL', 'Crawled - currently not indexed')], complete: true }))
      .toEqual({ _tag: 'not-indexed', inspectedAt: '2026-11-12T12:00:00.000Z', coverageState: 'Crawled - currently not indexed' })
  })

  it('does not use a verdict Google recorded before the Submission', () => {
    expect(resolveSubmissionOutcome(sent, { rows: [row('2026-11-09T12:00:00.000Z', 'PASS')], complete: true }))
      .toEqual({ _tag: 'not-inspected-since', inspectedAt: '2026-11-09T12:00:00.000Z' })
  })

  it('matches the exact URL, never a longer URL that contains it', () => {
    const longer = { url: `${sent.url}-2`, verdict: 'PASS', coverageState: null, lastCheckedAt: '2026-11-12T12:00:00.000Z' }
    expect(resolveSubmissionOutcome(sent, { rows: [longer], complete: true })).toEqual({ _tag: 'no-result' })
  })

  it('says the result was not read when the search returned only part of its matches', () => {
    const longer = { url: `${sent.url}-2`, verdict: 'PASS', coverageState: null, lastCheckedAt: '2026-11-12T12:00:00.000Z' }
    expect(resolveSubmissionOutcome(sent, { rows: [longer], complete: false })).toEqual({ _tag: 'not-read' })
  })

  it('files PARTIAL as not indexed, the same as gscdump\'s status filter', () => {
    expect(resolveSubmissionOutcome(sent, { rows: [row('2026-11-12T12:00:00.000Z', 'PARTIAL', 'Indexed, though blocked by robots.txt')], complete: true }))
      .toMatchObject({ _tag: 'not-indexed' })
  })

  it('never calls an inspection without a verdict not indexed', () => {
    expect(resolveSubmissionOutcome(sent, { rows: [row('2026-11-12T12:00:00.000Z', null, null)], complete: true }))
      .toEqual({ _tag: 'no-verdict', inspectedAt: '2026-11-12T12:00:00.000Z' })
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
