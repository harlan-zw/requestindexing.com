import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { indexingInvestigations } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { checkProToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'

// Keep in sync with `investigationStatusConfig` in
// layers/indexing/app/utils/indexing-issues.ts.
const investigationStatusSchema = z.enum(['investigated', 'monitoring', 'false_positive', 'wont_fix', 'fixed'])

// Bounded fan-out: at most 100 URLs written per request (one batched insert/
// delete, not a per-URL loop). This is a status/note tracker, not a live
// Google inspection, so there is no gscdump quota to protect here.
const bodySchema = z.object({
  urls: z.array(z.string().trim().min(1)).min(1).max(100),
  issueType: z.string().trim().min(1),
  action: z.enum(['set', 'remove']),
  status: investigationStatusSchema.optional(),
})

export default defineProApiHandler({ body: bodySchema, site: { ability: 'write-data' } }, async ({ event, body, site: access }) => {
  const { db, siteId, caller } = access
  const { urls, issueType, action, status } = body

  // Second bound: cap request frequency per caller/day so a scripted client
  // can't hammer this with many max-size bulk writes.
  await checkProToolRateLimit(event, {
    userId: String(caller.user.id),
  })

  if (action === 'set') {
    const resolvedStatus = status ?? 'investigated'
    const values = urls.map(url => ({
      siteId,
      url,
      issueType,
      status: resolvedStatus,
    }))

    await db.insert(indexingInvestigations)
      .values(values)
      .onConflictDoUpdate({
        target: [indexingInvestigations.siteId, indexingInvestigations.url, indexingInvestigations.issueType],
        set: { status: resolvedStatus, investigatedAt: new Date() },
      })
  }
  else {
    await db.delete(indexingInvestigations)
      .where(and(
        eq(indexingInvestigations.siteId, siteId),
        inArray(indexingInvestigations.url, urls),
        eq(indexingInvestigations.issueType, issueType),
      ))
  }

  return { ok: true, count: urls.length }
})
