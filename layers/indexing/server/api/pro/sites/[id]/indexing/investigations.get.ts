import { and, eq } from 'drizzle-orm'
import { indexingInvestigations } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Lists recorded investigation status/notes for a site's indexing issues.
// Optional `issueType` query filter narrows to a single issue type.
export default defineProApiHandler({ site: true }, async ({ event, site: access }) => {
  const { db, siteId } = access
  const query = getQuery(event)
  const issueType = typeof query.issueType === 'string' ? query.issueType : undefined

  const where = issueType
    ? and(eq(indexingInvestigations.siteId, siteId), eq(indexingInvestigations.issueType, issueType))
    : eq(indexingInvestigations.siteId, siteId)

  const rows = await db.select({
    url: indexingInvestigations.url,
    issueType: indexingInvestigations.issueType,
    status: indexingInvestigations.status,
    note: indexingInvestigations.note,
    investigatedAt: indexingInvestigations.investigatedAt,
  }).from(indexingInvestigations).where(where)

  return { investigations: rows }
})
