import { createError, readBody } from 'h3'
import { logger } from '~~/shared/server/logger'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { emitFirstProEvent } from '#layers/pro-saas/server/utils/pro-events'
import { PAGE_SETUP_COPY } from '#layers/pro-saas/shared/page-task'
import { inspectSavedPage } from '../../../../utils/page-evidence'
import { requirePageTaskSite } from '../../../../utils/page-task-site'

export default defineProApiHandler(async (event) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  const access = await requirePageTaskSite(event, true)
  const body: unknown = await readBody(event)
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).url !== access.task.url)
    throw createError({ statusCode: 409, message: PAGE_SETUP_COPY.changed })
  if (access.propertyRequired)
    return access.propertyRequired
  const siteId = access.site.gscdumpSiteId
  if (!siteId)
    throw createError({ statusCode: 409, message: 'Connect this Site to Search Console first.' })
  await emitFirstProEvent(access.db, access.caller.user.id, 'page_inspection_started', { taskId: access.task.id })
  return inspectSavedPage(access.task.url, () => access.client.inspectSiteUrls({ params: { siteId }, body: { urls: [access.task.url] } }).then(response => response.data), () => logger.warn('The selected page could not be inspected.'), new Date())
})
