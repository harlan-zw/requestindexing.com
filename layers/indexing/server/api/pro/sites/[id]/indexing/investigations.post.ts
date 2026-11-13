import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { indexingInvestigations } from '#layers/pro-saas/server/database'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

// Keep in sync with `investigationStatusConfig` in
// layers/indexing/app/utils/indexing-issues.ts.
const investigationStatusSchema = z.enum(['investigated', 'monitoring', 'false_positive', 'wont_fix', 'fixed'])

const bodySchema = z.object({
  url: z.string().trim().min(1),
  issueType: z.string().trim().min(1),
  investigated: z.boolean(),
  status: investigationStatusSchema.optional(),
  note: z.string().trim().max(2_000).optional(),
})

// Marks (or clears) the investigation status for a single URL/issue pair.
// This is a status/note tracker only, not a live Google inspection: it
// records what the user decided after looking into an already-diagnosed
// indexing issue.
export default defineProApiHandler({ body: bodySchema, site: { ability: 'write-data' } }, async ({ body, site: access }) => {
  const { db, siteId } = access
  const { url, issueType, investigated, status, note } = body

  if (investigated) {
    await db.insert(indexingInvestigations)
      .values({ siteId, url, issueType, status: status ?? 'investigated', note })
      .onConflictDoUpdate({
        target: [indexingInvestigations.siteId, indexingInvestigations.url, indexingInvestigations.issueType],
        set: { status: status ?? 'investigated', note, investigatedAt: new Date() },
      })
  }
  else {
    await db.delete(indexingInvestigations)
      .where(and(
        eq(indexingInvestigations.siteId, siteId),
        eq(indexingInvestigations.url, url),
        eq(indexingInvestigations.issueType, issueType),
      ))
  }

  return { ok: true }
})
