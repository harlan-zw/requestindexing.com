import { z } from 'zod'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readIndexingCohortUrls } from '#layers/pro-indexing/server/utils/indexing-cohort-urls'
import { indexCohortFilterSchema, parseIndexCohortFilter } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

const querySchema = z.object({
  cohort: z.string().transform(parseIndexCohortFilter).pipe(indexCohortFilterSchema),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  offset: z.coerce.number().int().min(0).max(2000).default(0),
  search: z.string().max(2048).optional(),
})

export default defineProApiHandler({ site: true }, async ({ event, site: access }) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const gscdumpSiteId = access.site.gscdumpSiteId
  if (!gscdumpSiteId)
    throw createError({ statusCode: 404 })
  const client = useGscdumpClient()
  const result = await readIndexingCohortUrls(
    page => client.getIndexingUrls(gscdumpSiteId, page),
    query,
    access.site.property,
  )
  // A partial snapshot cannot establish the group's total or page boundaries.
  if (result._tag === 'truncated')
    throw createError({ statusCode: 503 })
  return result.data
})
