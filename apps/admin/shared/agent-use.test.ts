import type { CustomerIntegrationActivity } from './customer-insights'
import { describe, expect, it } from 'vitest'
import { buildAgentUseJourney } from './agent-use'

const activity = (input: Partial<CustomerIntegrationActivity>): CustomerIntegrationActivity => ({ surface: 'mcp', client: 'claude', label: 'Claude', configuredUsers: null, successfulUsers: 1, successfulCalls: 2, firstObservedAt: '2026-11-02T00:00:00.000Z', lastObservedAt: '2026-11-03T00:00:00.000Z', coverage: 'retained', note: 'Credential-scoped history.', ...input })
describe('agent use after the local signup', () => {
  it('uses qualified first and last successes across clients without adding users', () => {
    expect(buildAgentUseJourney('2026-11-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z', [activity({}), activity({ client: 'unknown', lastObservedAt: '2026-11-04T00:00:00.000Z' })])).toMatchObject({ _tag: 'Observed', firstSuccessfulAt: '2026-11-02T00:00:00.000Z', returnedAt: '2026-11-04T00:00:00.000Z', firstUseSeconds: 86400, returnBasis: 'last_observed_success' })
  })
  it('does not count setup or API traffic as successful agent use', () => {
    expect(buildAgentUseJourney('2026-11-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z', [activity({ surface: 'api' }), activity({ surface: 'cli', configuredUsers: 1, successfulUsers: null })])).toMatchObject({ _tag: 'Unavailable', reason: 'success_time' })
  })
  it('keeps pre-signup and future observations unavailable', () => {
    expect(buildAgentUseJourney('2026-11-05T00:00:00.000Z', '2026-11-10T00:00:00.000Z', [activity({}), activity({ firstObservedAt: '2026-11-11T00:00:00.000Z' })])).toMatchObject({ _tag: 'Unavailable' })
  })
  it('requires a full day between first and latest observed success', () => {
    expect(buildAgentUseJourney('2026-11-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z', [activity({ lastObservedAt: '2026-11-02T23:59:59.000Z' })])).toMatchObject({ _tag: 'Observed', returnedAt: null })
  })
  it('does not use a malformed client interval to invent return use', () => {
    expect(buildAgentUseJourney('2026-11-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z', [activity({ lastObservedAt: '2026-11-02T00:00:00.000Z' }), activity({ firstObservedAt: '2026-11-11T00:00:00.000Z', lastObservedAt: '2026-11-09T00:00:00.000Z' })])).toMatchObject({ _tag: 'Observed', returnedAt: null })
  })
})
