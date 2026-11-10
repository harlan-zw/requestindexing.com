import type { H3Event } from 'h3'
import type { FunnelAccount, FunnelEvent, FunnelSite } from '../../shared/funnel-observations'
import { sql } from 'drizzle-orm'
import { buildObservedFunnelUsers } from '../../shared/funnel-observations'

/** Local milestone facts only. No Google calls or credential projection. */
export async function readFunnelUsers(event: H3Event, now = Date.now()) {
  const db = useDrizzle(event)
  const [accounts, events, sites] = await Promise.all([
    db.all<FunnelAccount>(sql`SELECT user_id AS id, name, email, created_at AS createdAt, onboarding_completed_at AS completedAt, source, current_team_id AS teamId, gscdump_user_id AS engineUserId, onboarding_answers AS onboardingAnswers FROM users`),
    db.all<FunnelEvent>(sql`SELECT user_id AS userId, type, created_at AS createdAt, payload FROM pro_events WHERE type IN ('signed_up', 'gsc_connected', 'site_added', 'onboarding_completed', 'page_evidence_viewed', 'first_report_evidence_viewed', 'setup_feedback') ORDER BY pro_event_id`),
    db.all<FunnelSite>(sql`SELECT team_id AS teamId FROM sites WHERE active = 1`),
  ])
  return buildObservedFunnelUsers(accounts, events, sites, now)
}
