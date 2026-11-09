import { expect, it } from 'vitest'
import { parseCustomerInsightsQuery } from './customer-insights'
import { buildFunnelReport, parseFunnelQuery } from './funnel'
import { buildObservedFunnelUsers } from './funnel-observations'
import { stagePairDelays, summarizeDelays } from './journey-evidence'

const start = Date.parse('2026-11-01T00:00:00Z')
const account = { id: 1, name: 'Ada', email: 'ada@example.test', createdAt: start - 100000, completedAt: null, source: 'changed-current-source', teamId: 3, engineUserId: 'engine-one' }

it('preserves the original source and first stage time while separating feedback and attempts from evidence', () => {
  const users = buildObservedFunnelUsers([account], [
    { userId: 1, type: 'signed_up', createdAt: start, payload: JSON.stringify({ source: 'pro-free', provider: 'google' }) },
    { userId: 1, type: 'gsc_connected', createdAt: start + 60000, payload: null },
    { userId: 1, type: 'gsc_connected', createdAt: start + 120000, payload: null },
    { userId: 1, type: 'site_added', createdAt: (start + 180000) / 1000, payload: null },
    { userId: 1, type: 'first_report_started', createdAt: start + 240000, payload: null },
    { userId: 1, type: 'setup_example_viewed', createdAt: start + 300000, payload: null },
    { userId: 1, type: 'setup_feedback', createdAt: start + 360000, payload: { reason: 'time', step: 'page' } },
  ], [{ teamId: 3 }, { teamId: 3 }, { teamId: 9 }], start + 600000)
  expect(users[0]?.acquisition).toMatchObject({ label: 'pro-free', basis: 'legacy', provider: 'google' })
  expect(users[0]?.journey.stageTimes).toMatchObject({ googleConnected: new Date(start + 60000).toISOString(), siteConnected: new Date(start + 180000).toISOString(), evidenceViewed: null })
  expect(users[0]?.journey.delays[1]).toMatchObject({ _tag: 'Known', milliseconds: 120000 })
  expect(users[0]?.currentSites).toMatchObject({ count: 2, knownUrlCount: null, unknownSizeSites: 2 })
  expect(users[0]?.feedback).toEqual([{ reason: 'time', step: 'page', recordedAt: new Date(start + 360000).toISOString() }])
})

it('does not fill unknown original attribution from a mutable current field', () => {
  const users = buildObservedFunnelUsers([account], [{ userId: 1, type: 'signed_up', createdAt: start, payload: { source: null } }], [], start + 1)
  expect(users[0]?.acquisition).toMatchObject({ label: 'Unattributed', basis: 'unknown' })
})

it('exposes bounded campaign detail and preserves its actual capture time', () => {
  const capturedAt = new Date(start - 60000).toISOString()
  const user = buildObservedFunnelUsers([account], [{ userId: 1, type: 'signed_up', createdAt: start, payload: { attributionBasis: 'journey_linked', attributionSource: 'utm:docs', utmSource: 'docs', utmMedium: 'email', utmCampaign: 'november', utmContent: 'header', utmTerm: 'indexing', referrerDomain: 'search.example', landingPath: '/tools', capturedAt } }], [], start + 1)[0]!
  expect(user.acquisition).toMatchObject({ utmSource: 'docs', utmMedium: 'email', utmCampaign: 'november', utmContent: 'header', utmTerm: 'indexing', referrerDomain: 'search.example', landingPath: '/tools', capturedAt })
  const missing = buildObservedFunnelUsers([account], [], [], start + 1)[0]!
  expect(missing.acquisition).toMatchObject({ utmSource: null, referrerDomain: null, capturedAt: null })
})

it('keeps a valid maximum-length referral source selectable in both reports', () => {
  const domain = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(61)].join('.')
  const source = `referral:${domain}`
  const users = buildObservedFunnelUsers([account], [{ userId: 1, type: 'signed_up', createdAt: start, payload: { attributionBasis: 'journey_linked', attributionSource: source } }], [], start + 1)
  expect(users[0]?.acquisition).toMatchObject({ label: source, basis: 'captured' })
  const query = parseFunnelQuery({ from: '2026-11-01', to: '2026-11-01', source })
  expect(buildFunnelReport(users, query, start + 1).total).toBe(1)
  expect(parseCustomerInsightsQuery({ source }).success).toBe(true)
})

it('counts only stages inside the observed signup lifetime and keeps invalid history separate', () => {
  const observations = [
    { userId: 1, type: 'signed_up', createdAt: start, payload: null },
    { userId: 1, type: 'gsc_connected', createdAt: start - 1000, payload: null },
    { userId: 1, type: 'gsc_connected', createdAt: start + 1000, payload: null },
    { userId: 1, type: 'site_added', createdAt: start + 900000, payload: null },
  ]
  const user = buildObservedFunnelUsers([account], observations, [], start + 10000)[0]!
  expect(user.googleConnected).toBe(true)
  expect(user.journey.stageTimes.googleConnected).toBe(new Date(start + 1000).toISOString())
  expect(user.siteConnected).toBe(false)
  expect(user.journey.stageTimes.siteConnected).toBeNull()
  expect(user.journey.invalidHistory).toEqual({ beforeSignup: 1, future: 1, invalidTimestamp: 0 })
})

it('does not clamp missing, future or reversed timestamps into a successful zero duration', () => {
  const pairs = stagePairDelays({ signedUp: new Date(start).toISOString(), googleConnected: new Date(start - 1).toISOString(), siteConnected: new Date(start + 999999).toISOString(), evidenceViewed: null, setupCompleted: null }, start + 100000)
  expect(pairs.map(pair => pair._tag)).toEqual(['OutOfOrder', 'Future', 'Missing', 'Missing'])
  const summary = summarizeDelays([{ stageTimes: { signedUp: null, googleConnected: null, siteConnected: null, evidenceViewed: null, setupCompleted: null }, delays: pairs, coverage: 'first-recorded', cutoff: new Date(start).toISOString() }])
  expect(summary[0]).toMatchObject({ knownPairs: 0, reversedPairs: 1, medianMs: null })
})
