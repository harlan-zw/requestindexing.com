import type { ObservedFunnelUser } from './funnel-observations'
import type { AcquisitionEvidence } from './journey-evidence'
import { z } from 'zod'
import { defaultFunnelDates } from './funnel'
import { ADMIN_JOURNEY_COPY } from './journey-evidence'

/** Version 1 matches the central admin contract. Null means unmeasured. */
export interface CustomerIntegrationActivity {
  surface: 'mcp' | 'cli' | 'api' | 'unknown'
  client: string
  label: string
  configuredUsers: number | null
  successfulUsers: number | null
  successfulCalls: number | null
  firstObservedAt: string | null
  lastObservedAt: string | null
  coverage: 'retained' | 'unavailable'
  note: string
}
export interface CustomerInsightsUser {
  userId: string
  name: string | null
  email: string | null
  source: { label: string, basis: 'captured' | 'legacy' | 'unknown' }
  acquisition: AcquisitionEvidence
  goals: string[]
  other: string | null
  integrations: CustomerIntegrationActivity[]
}
export interface CustomerInsightsResponse {
  version: 1
  capabilities: { goals: boolean, acquisition: boolean, integrationActivity: boolean }
  metricCoverage: { activated: 'measured' | 'unavailable', paid: 'measured' | 'unavailable', returned: 'measured' | 'unavailable' }
  coverage: { cohortUsers: number, goalAnswers: number, attributedUsers: number, signupEvents: number, accountDateFallbacks: number, note: string }
  segments: { dimension: 'goal' | 'source', key: string, label: string, users: number, activated: number, paid: number | null, returned: number | null }[]
  integrations: CustomerIntegrationActivity[]
  users: CustomerInsightsUser[]
  pagination: { page: number, perPage: number, total: number, hasMore: boolean }
}

const querySchema = z.object({
  timeRange: z.string().regex(/^\d{1,3}d$/).default('30d'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(250).default(100),
  userId: z.string().regex(/^[1-9]\d{0,14}$/).optional(),
  source: z.string().min(1).max(320).optional(),
  search: z.string().max(100).optional(),
}).strict().refine(input => Number.parseInt(input.timeRange) >= 1 && Number.parseInt(input.timeRange) <= 366)
export function parseCustomerInsightsQuery(input: unknown) {
  return querySchema.safeParse(input)
}

const integrations: CustomerIntegrationActivity[] = (['mcp', 'cli', 'api'] as const).map(surface => ({
  surface,
  client: 'unknown',
  label: surface.toUpperCase(),
  configuredUsers: null,
  successfulUsers: null,
  successfulCalls: null,
  firstObservedAt: null,
  lastObservedAt: null,
  coverage: 'unavailable',
  note: ADMIN_JOURNEY_COPY.integrationHelp,
}))

export function buildCustomerInsights(users: ObservedFunnelUser[], query: z.infer<typeof querySchema>, now: number): CustomerInsightsResponse & { users: (CustomerInsightsUser & Pick<ObservedFunnelUser, 'journey' | 'currentSites' | 'feedback' | 'engineUserId'>)[] } {
  const period = defaultFunnelDates(now, Number.parseInt(query.timeRange))
  const start = Date.parse(`${period.from}T00:00:00Z`)
  const end = Date.parse(`${period.to}T00:00:00Z`) + 86400000
  const cohort = users.filter(user => (query.userId ? String(user.id) === query.userId : Date.parse(user.signedUpAt) >= start && Date.parse(user.signedUpAt) < end)
    && (!query.source || user.source === query.source)
    && (!query.search || `${user.name ?? ''} ${user.email}`.toLowerCase().includes(query.search.toLowerCase())))
  const sources = [...new Set(cohort.map(user => user.source))].sort()
  const total = cohort.length
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.perPage)))
  return {
    version: 1,
    capabilities: { goals: false, acquisition: true, integrationActivity: false },
    metricCoverage: { activated: 'measured', paid: 'unavailable', returned: 'unavailable' },
    coverage: { cohortUsers: total, goalAnswers: 0, attributedUsers: cohort.filter(user => user.acquisition.basis !== 'unknown').length, signupEvents: cohort.filter(user => user.signupEvidence === 'event').length, accountDateFallbacks: cohort.filter(user => user.signupEvidence === 'account').length, note: ADMIN_JOURNEY_COPY.coverage },
    segments: sources.map((source) => {
      const rows = cohort.filter(user => user.source === source)
      return { dimension: 'source', key: source, label: source, users: rows.length, activated: rows.filter(user => !!user.journey.stageTimes.evidenceViewed).length, paid: null, returned: null }
    }),
    integrations,
    users: [...cohort].sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt) || b.id - a.id).slice((page - 1) * query.perPage, page * query.perPage).map(user => ({
      userId: String(user.id),
      name: user.name,
      email: user.email,
      source: { label: user.acquisition.label, basis: user.acquisition.basis },
      acquisition: user.acquisition,
      goals: [],
      other: null,
      integrations,
      journey: user.journey,
      currentSites: user.currentSites,
      feedback: user.feedback,
      engineUserId: user.engineUserId,
    })),
    pagination: { page, perPage: query.perPage, total, hasMore: page * query.perPage < total },
  }
}
