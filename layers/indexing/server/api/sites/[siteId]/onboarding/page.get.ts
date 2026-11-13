import { setHeader } from 'h3'
import { logger } from '~~/shared/server/logger'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { readSavedPageEvidence } from '../../../../utils/page-evidence'
import { requirePageTaskSite } from '../../../../utils/page-task-site'

export default defineProApiHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const access = await requirePageTaskSite(event)
  if (access.propertyRequired)
    return access.propertyRequired
  const siteId = access.site.gscdumpSiteId
  if (!siteId)
    return { _tag: 'Pending' as const }
  return readSavedPageEvidence(access.task.url, offset => access.client.listSiteIndexingUrls({ params: { siteId }, query: { search: access.task.url, offset, limit: 100, count: 0 } }).then(response => response.data), () => logger.warn('Saved URL Inspection evidence is unavailable.'))
})
