import { createError, readValidatedBody, setHeader } from 'h3'
import { z } from 'zod'
import { logger } from '~~/shared/server/logger'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { FIRST_REPORT_COPY } from '../../../../../shared/first-report'
import { firstReportPlanMatches, verifyFirstReportPlan } from '../../../../utils/first-report'
import { firstReportSecret, requireFirstReportSite } from '../../../../utils/first-report-site'
import { readSavedPageEvidence } from '../../../../utils/page-evidence'

const schema = z.object({ token: z.string().max(40000) }).strict()

export default defineProApiHandler(async (event) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const access = await requireFirstReportSite(event)
  const body = await readValidatedBody(event, schema.parse)
  const plan = await verifyFirstReportPlan(body.token, firstReportSecret(event), Date.now())
  if (!plan || !firstReportPlanMatches(plan, { userId: access.caller.user.id, teamId: access.teamId, siteId: access.site.id, remoteSiteId: access.remoteSiteId, property: access.property }))
    throw createError({ statusCode: 409, message: FIRST_REPORT_COPY.viewChanged })
  const rows = await Promise.all(plan.urls.map(url => readSavedPageEvidence(url, offset => access.client.listSiteIndexingUrls({ params: { siteId: access.remoteSiteId }, query: { search: url, offset, limit: 100, count: 0 } }).then(response => response.data), () => logger.warn('First report evidence could not be read.'))))
  const count = rows.filter(row => row._tag === 'Evidence').length
  const recorded = count > 0 && await emitFirstProEvent(access.db, access.caller.user.id, 'first_report_evidence_viewed', { siteId: access.site.id, count })
  return { recorded }
})
