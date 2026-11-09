import type { FunnelQuery, FunnelUser } from './funnel'
import { buildFunnelReport } from './funnel'
import { JOURNEY_STAGES } from './journey-evidence'

const acquisitionColumns = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
  ['referrerDomain', 'referrer_domain'],
  ['landingPath', 'landing_group'],
  ['capturedAt', 'attribution_captured_at_utc'],
  ['provider', 'signup_provider'],
  ['channelClass', 'acquisition_channel'],
] as const

/** Spreadsheet programs also recognize formulas after leading control characters. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const firstContent = text.replace(/^[\s\p{Cc}\p{Cf}]+/u, '')
  const guarded = /^[=+\-@]/u.test(firstContent) ? `'${text}` : text
  return `"${guarded.replaceAll('"', '""')}"`
}

export function exportFunnelCsv(users: FunnelUser[], query: FunnelQuery, now: number): string {
  const initial = buildFunnelReport(users, { ...query, page: 1 }, now)
  const rows = [...initial.users]
  for (let page = 2; page <= initial.pagination.pageCount; page++) rows.push(...buildFunnelReport(users, { ...query, page }, now).users)
  const columns = ['user_id', 'engine_user_id', 'name', 'email', 'product', 'signup_source', 'source_basis', ...acquisitionColumns.map(([, name]) => name), 'signup_evidence', 'signup_at_utc', ...JOURNEY_STAGES.slice(1).map(stage => `${stage}_at_utc`), ...JOURNEY_STAGES.slice(1).flatMap(stage => [`${stage}_delay_ms`, `${stage}_delay_coverage`]), 'current_team_sites', 'unknown_site_sizes', 'feedback', 'observation_cutoff_utc', 'milestone_coverage', 'integration_coverage']
  const values = rows.map(user => [user.id, user.engineUserId, user.name, user.email, 'request-indexing', user.source, user.acquisition?.basis ?? 'unknown', ...acquisitionColumns.map(([key]) => user.acquisition?.[key] ?? null), user.signupEvidence, user.signedUpAt, ...JOURNEY_STAGES.slice(1).map(stage => user.journey?.stageTimes[stage] ?? null), ...JOURNEY_STAGES.slice(1).flatMap((stage) => {
    const delay = user.journey?.delays.find(pair => pair.to === stage)
    return [delay?.milliseconds ?? null, delay?._tag ?? 'Missing']
  }), user.currentSites?.count ?? null, user.currentSites?.unknownSizeSites ?? null, JSON.stringify(user.feedback ?? []), new Date(now).toISOString(), 'first-recorded', 'unavailable'])
  return [columns, ...values].map(row => row.map(csvCell).join(',')).join('\r\n')
}
