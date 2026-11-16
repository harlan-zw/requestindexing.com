import type { CustomerIntegrationActivity } from './customer-insights'

export type AgentUseJourney
  = | { _tag: 'Unavailable', signedUpAt: string | null, reason: 'signup_time' | 'success_time' }
    | { _tag: 'Observed', signedUpAt: string, firstSuccessfulAt: string, lastSuccessfulAt: string, returnedAt: string | null, firstUseSeconds: number, returnAfterSeconds: 86400, returnBasis: 'last_observed_success' }

/** Existing engine observations are credential-scoped. Missing history is not measured zero use. */
export function buildAgentUseJourney(signedUpAt: string | null, observedThrough: string, activities: CustomerIntegrationActivity[]): AgentUseJourney {
  const signup = signedUpAt ? Date.parse(signedUpAt) : Number.NaN
  const through = Date.parse(observedThrough)
  if (!Number.isFinite(signup) || !Number.isFinite(through) || signup > through)
    return { _tag: 'Unavailable', signedUpAt, reason: 'signup_time' }
  const qualified = activities.filter((row) => {
    const first = row.firstObservedAt ? Date.parse(row.firstObservedAt) : Number.NaN
    const last = row.lastObservedAt ? Date.parse(row.lastObservedAt) : first
    return ['mcp', 'cli'].includes(row.surface) && (row.successfulUsers ?? 0) > 0
      && Number.isFinite(first) && Number.isFinite(last) && first >= signup && first <= last && last <= through
  })
  const first = qualified.map(row => row.firstObservedAt ? Date.parse(row.firstObservedAt) : Number.NaN).filter(at => Number.isFinite(at) && at >= signup && at <= through)
  if (!first.length)
    return { _tag: 'Unavailable', signedUpAt, reason: 'success_time' }
  const firstAt = Math.min(...first)
  const last = qualified.map(row => row.lastObservedAt ? Date.parse(row.lastObservedAt) : Number.NaN).filter(at => Number.isFinite(at) && at >= firstAt && at <= through)
  const lastAt = last.length ? Math.max(firstAt, ...last) : firstAt
  return { _tag: 'Observed', signedUpAt: new Date(signup).toISOString(), firstSuccessfulAt: new Date(firstAt).toISOString(), lastSuccessfulAt: new Date(lastAt).toISOString(), returnedAt: lastAt - firstAt >= 86400000 ? new Date(lastAt).toISOString() : null, firstUseSeconds: (firstAt - signup) / 1000, returnAfterSeconds: 86400, returnBasis: 'last_observed_success' }
}
