import { sql } from 'drizzle-orm'
import { buildFunnelReport, funnelTimestamp, parseFunnelQuery } from '../../../shared/funnel'
import { requireAdminAuth } from '../../utils/admin'

interface FunnelRow {
  id: number
  name: string | null
  email: string
  createdAt: number | string
  signedUpAt: number | null
  source: string | null
  googleConnected: number
  siteConnected: number
  setupCompleted: number
}

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  let query
  try {
    query = parseFunnelQuery(getQuery(event))
  }
  catch (error) {
    throw createError({ statusCode: 400, message: (error as Error).message })
  }
  const db = useDrizzle(event)
  // One row per user, regardless of duplicate or retried milestone writes.
  // Only projections needed by the report cross this seam; no credentials.
  const rows = await db.all<FunnelRow>(sql`
    WITH milestones AS (
      SELECT user_id,
        MIN(CASE WHEN type = 'signed_up' THEN created_at END) AS signed_up_at,
        MAX(CASE WHEN type = 'gsc_connected' THEN 1 ELSE 0 END) AS google_connected,
        MAX(CASE WHEN type = 'site_added' THEN 1 ELSE 0 END) AS site_connected,
        MAX(CASE WHEN type = 'onboarding_completed' THEN 1 ELSE 0 END) AS setup_completed
      FROM pro_events
      WHERE type IN ('signed_up', 'gsc_connected', 'site_added', 'onboarding_completed')
      GROUP BY user_id
    )
    SELECT u.user_id AS id, u.name, u.email, u.created_at AS createdAt,
      m.signed_up_at AS signedUpAt, u.source,
      COALESCE(m.google_connected, 0) AS googleConnected,
      COALESCE(m.site_connected, 0) AS siteConnected,
      CASE WHEN u.onboarding_completed_at IS NOT NULL OR m.setup_completed = 1 THEN 1 ELSE 0 END AS setupCompleted
    FROM users u LEFT JOIN milestones m ON m.user_id = u.user_id
  `)
  return buildFunnelReport(rows.flatMap((row) => {
    const signedUpAt = funnelTimestamp(row.signedUpAt) ?? funnelTimestamp(row.createdAt)
    return signedUpAt
      ? [{
          id: row.id,
          name: row.name,
          email: row.email,
          signedUpAt,
          signupEvidence: row.signedUpAt === null ? 'account' as const : 'event' as const,
          source: row.source || 'Unattributed',
          googleConnected: row.googleConnected === 1,
          siteConnected: row.siteConnected === 1,
          setupCompleted: row.setupCompleted === 1,
        }]
      : []
  }), query)
})
