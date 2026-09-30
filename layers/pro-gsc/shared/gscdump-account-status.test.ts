import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_STATUS_MAX_AGE_MS,
  FAILED_READ_MAX_AGE_MS,
  lookupCachedAccountStatus,
} from './gscdump-account-status'

const NOW = 1_800_000_000_000

describe('lookupCachedAccountStatus', () => {
  it('returns a recent read', () => {
    const entry = { _tag: 'Read', status: 'scope_missing', readAt: NOW - 1000 }
    expect(lookupCachedAccountStatus(entry, NOW)).toEqual({ _tag: 'Hit', status: 'scope_missing' })
  })

  it('misses once a read is older than its max age', () => {
    const entry = { _tag: 'Read', status: 'ready', readAt: NOW - ACCOUNT_STATUS_MAX_AGE_MS - 1 }
    expect(lookupCachedAccountStatus(entry, NOW)).toEqual({ _tag: 'Miss' })
  })

  it('holds a failed read briefly as unknown, so an outage is not retried on every request', () => {
    const entry = { _tag: 'Failed', readAt: NOW - 1000 }
    expect(lookupCachedAccountStatus(entry, NOW)).toEqual({ _tag: 'Hit', status: null })
  })

  it('retries a failed read after its shorter max age', () => {
    const entry = { _tag: 'Failed', readAt: NOW - FAILED_READ_MAX_AGE_MS - 1 }
    expect(lookupCachedAccountStatus(entry, NOW)).toEqual({ _tag: 'Miss' })
  })

  it.each([
    ['nothing stored', null],
    ['a status gscdump does not define', { _tag: 'Read', status: 'mystery', readAt: NOW }],
    ['a missing timestamp', { _tag: 'Read', status: 'ready' }],
    ['a read from the future', { _tag: 'Read', status: 'ready', readAt: NOW + 60_000 }],
    ['an older entry shape', { status: 'ready', refreshedAt: '2026-09-01T00:00:00Z' }],
  ])('misses on %s', (_label, entry) => {
    expect(lookupCachedAccountStatus(entry, NOW)).toEqual({ _tag: 'Miss' })
  })
})
