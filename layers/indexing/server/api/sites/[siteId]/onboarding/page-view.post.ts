import { readBody } from 'h3'
import { logger } from '~~/shared/server/logger'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { savePageTask } from '#layers/pro-saas/server/utils/page-task'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { readSavedPageEvidence } from '../../../../utils/page-evidence'
import { requirePageTaskSite } from '../../../../utils/page-task-site'

export default defineProApiHandler(async (event) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  const access = await requirePageTaskSite(event)
  const body: unknown = await readBody(event)
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).url !== access.task.url)
    return { recorded: false }
  if (access.propertyRequired)
    return { recorded: false }
  const siteId = access.site.gscdumpSiteId
  if (!siteId)
    return { recorded: false }
  const read = await readSavedPageEvidence(access.task.url, offset => access.client.listSiteIndexingUrls({ params: { siteId }, query: { search: access.task.url, offset, limit: 100, count: 0 } }).then(response => response.data), () => logger.warn('The selected page view could not be verified.'))
  if (read._tag !== 'Evidence')
    return { recorded: false }
  await emitFirstProEvent(access.db, access.caller.user.id, 'page_evidence_viewed', { taskId: access.task.id })
  await savePageTask(event, { ...access.task, evidenceViewedAt: Date.now() })
  return { recorded: true }
})
