import { parseIndexCohortFilter } from '@gscdump/sdk/indexing'
import { z } from 'zod'
import { readIndexingCohortUrls } from '#layers/indexing/server/utils/indexing-cohort-urls'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { assertLocalRegisteredGscSiteScope } from '#layers/pro-gsc/server/utils/registered-site-scope'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'

const querySchema = z.object({
  cohort: z.string().transform((value, ctx) => {
    const parsed = parseIndexCohortFilter(value)
    if (parsed._tag === 'ok')
      return parsed.filter
    ctx.addIssue({ code: 'custom', message: 'invalid_cohort' })
    return z.NEVER
  }),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  offset: z.coerce.number().int().min(0).max(2000).default(0),
  search: z.string().max(2048).optional(),
})

export default defineProApiHandler({ site: true }, async ({ db, event, site: access }) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const gscdumpSiteId = access.site.gscdumpSiteId
  if (!gscdumpSiteId)
    throw createError({ statusCode: 404 })
  const client = useGscdumpClient()
  await assertLocalRegisteredGscSiteScope(db, access.site.id, gscdumpSiteId, id => client.getRegisteredHostIdentity(id))
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
