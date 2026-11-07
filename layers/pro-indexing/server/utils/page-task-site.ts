import type { H3Event } from 'h3'
import type { PagePropertyRequired } from '../../shared/page-evidence'
import { isVerifiedGscPermission } from 'gscdump'
import { createError } from 'h3'
import { logger } from '~~/shared/server/logger'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { assertLocalRegisteredGscSiteScope } from '#layers/pro-gsc/server/utils/registered-site-scope'
import { readCallerGscdumpUserId } from '#layers/pro-saas/server/utils/caller-rows'
import { loadPageTask } from '#layers/pro-saas/server/utils/page-task'
import { requireSiteAccess } from '#layers/pro-saas/server/utils/require-site-access'
import { pagePropertyCoversUrl, savedPageMatchesHost } from '#layers/pro-saas/shared/page-task'
import { connectedSiteDomain } from '#layers/pro-saas/shared/site-url'

export async function requirePageTaskSite(event: H3Event, write = false) {
  const access = await requireSiteAccess(event, write ? { ability: 'write-data' } : undefined)
  const read = await loadPageTask(event)
  if (read._tag !== 'Available' || read.task.ownerId !== access.caller.user.id || access.teamId !== access.caller.currentTeamId)
    throw createError({ statusCode: 404, message: 'Saved page not found.' })
  if (!savedPageMatchesHost(read.task.url, connectedSiteDomain(access.site) ?? ''))
    throw createError({ statusCode: 404, message: 'Site not found' })
  const client = createGscdumpPublicV1Client(event, { attempts: 1 })
  let propertyRequired: PagePropertyRequired | null = null
  if (access.site.gscdumpSiteId) {
    let principalId: string | null = null
    await assertLocalRegisteredGscSiteScope(access.db, access.site.id, access.site.gscdumpSiteId, async (id) => {
      const registration = await client.getRegisteredHostIdentity({ params: { siteId: id } }).then(response => response.data)
      principalId = registration.identity.userId
      return registration
    }, read.task.url)
    if (!principalId)
      throw createError({ statusCode: 503, message: 'Search Console status is unavailable.' })
    const lifecycle = await client.getUserLifecycle({ params: { userId: principalId } }).then(response => response.data)
    const remote = lifecycle.sites.find(site => site.siteId === access.site.gscdumpSiteId)
    if (!remote)
      throw createError({ statusCode: 503, message: 'Search Console status is unavailable.' })
    if (!remote.gscPropertyUrl || !pagePropertyCoversUrl(read.task.url, remote.gscPropertyUrl)) {
      // An existing registration keeps its property. Never rebind or delete its history here.
      const callerId = await readCallerGscdumpUserId(event, access.db, access.caller.user.id)
      const available = callerId
        ? await client.listAvailableSites({ params: { userId: callerId }, query: {} }).then(response => response.data.sites).catch(() => {
            logger.warn('Alternative Search Console properties could not load.')
            return []
          })
        : []
      propertyRequired = { _tag: 'PropertyRequired', property: remote.gscPropertyUrl, alternatives: available.filter(property => isVerifiedGscPermission(property.permissionLevel) && pagePropertyCoversUrl(read.task.url, property.siteUrl)).map(property => property.siteUrl) }
    }
  }
  return { ...access, task: read.task, client, propertyRequired }
}
