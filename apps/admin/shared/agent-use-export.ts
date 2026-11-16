import type { UserIntegrationActivityV1 } from '@gscdump/contracts/v1'
import type { AgentUseJourney } from './agent-use'
import { csvCell } from './funnel-export'

export interface ReportedSkillActivity {
  surface: 'mcp' | 'cli' | 'api'
  client: string
  name: string
  version: string | null
  successfulUsers: number | null
  successfulCalls: number | null
  firstObservedAt: string | null
  lastObservedAt: string | null
  note: string
}
export type AgentActivityData = UserIntegrationActivityV1 & { skills?: ReportedSkillActivity[], skillsTruncated?: boolean }
export type AgentActivityRead = { _tag: 'Unlinked' } | ({ _tag: 'Available', localJourney: AgentUseJourney } & AgentActivityData)

export function exportAgentUseCsv(input: Extract<AgentActivityRead, { _tag: 'Available' }>, engineUserId: string): string {
  const journey = input.localJourney
  const known = journey._tag === 'Observed' ? journey : null
  const columns = ['engine_user_id', 'record_type', 'surface', 'reported_client', 'skill_name', 'skill_version', 'configured_users', 'successful_users', 'successful_calls', 'first_observed_at_utc', 'last_observed_at_utc', 'signup_at_utc', 'first_successful_agent_call_at_utc', 'last_successful_agent_call_at_utc', 'latest_qualifying_return_at_utc', 'return_after_seconds', 'return_basis', 'coverage', 'skills_truncated', 'note', 'measured_at_utc']
  const common = [journey.signedUpAt, known?.firstSuccessfulAt, known?.lastSuccessfulAt, known?.returnedAt, 86400, 'last_observed_success']
  const activities = input.activities.map(row => [engineUserId, 'integration', row.surface, row.client, null, null, row.configuredUsers, row.successfulUsers, row.successfulCalls, row.firstObservedAt, row.lastObservedAt, ...common, row.coverage, input.skillsTruncated ?? null, row.note, input.measuredAt])
  const skills = input.skills?.map(row => [engineUserId, 'reported_skill', row.surface, row.client, row.name, row.version, null, row.successfulUsers, row.successfulCalls, row.firstObservedAt, row.lastObservedAt, ...common, 'retained', input.skillsTruncated ?? null, row.note, input.measuredAt])
    ?? [[engineUserId, 'reported_skill', null, null, null, null, null, null, null, null, null, ...common, 'unavailable', null, null, input.measuredAt]]
  return [columns, ...activities, ...skills].map(row => row.map(csvCell).join(',')).join('\r\n')
}
