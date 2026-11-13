import { createError, readValidatedBody, setHeader } from 'h3'
import { z } from 'zod'
import { logger } from '~~/shared/server/logger'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { FIRST_REPORT_COPY } from '../../../../../shared/first-report'
import { firstReportPlanMatches, verifyFirstReportPlan } from '../../../../utils/first-report'
import { firstReportSecret, requireFirstReportSite } from '../../../../utils/first-report-site'
import { inspectFirstReport } from '../../../../utils/page-evidence'

const schema = z.object({ token: z.string().max(40000) }).strict()

export default defineProApiHandler(async (event) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const access = await requireFirstReportSite(event, true)
  const body = await readValidatedBody(event, schema.parse)
  const plan = await verifyFirstReportPlan(body.token, firstReportSecret(event), Date.now())
  const changed = () => createError({ statusCode: 409, message: FIRST_REPORT_COPY.changed })
  if (!plan || !firstReportPlanMatches(plan, { userId: access.caller.user.id, teamId: access.teamId, siteId: access.site.id, remoteSiteId: access.remoteSiteId, property: access.property }))
    throw changed()
  const preview = await access.readCandidates(plan.generationId)
  if (preview._tag !== 'Ready' || JSON.stringify(preview.urls) !== JSON.stringify(plan.urls))
    throw changed()
  await emitFirstProEvent(access.db, access.caller.user.id, 'first_report_started', { siteId: access.site.id, count: plan.urls.length })
  return inspectFirstReport(plan.urls, () => access.client.inspectSiteUrls({ params: { siteId: access.remoteSiteId }, body: { urls: plan.urls } }).then(response => response.data), () => logger.warn('The first report inspection outcome is unavailable.'), new Date())
})
