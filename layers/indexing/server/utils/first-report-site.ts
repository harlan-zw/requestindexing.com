import type { H3Event } from 'h3'
import { createError } from 'h3'
import { createGscdumpPublicV1Client } from '#layers/pro-gsc/server/utils/gscdump-origin'
import { assertLocalRegisteredGscSiteScope } from '#layers/pro-gsc/server/utils/registered-site-scope'
import { requireSiteAccess } from '#layers/pro-saas/server/utils/require-site-access'
import { connectedSiteDomain } from '#layers/pro-saas/shared/site-url'
import { readFirstReportCandidates } from './first-report'

export async function requireFirstReportSite(event: H3Event, write = false) {
  const access = await requireSiteAccess(event, write ? { ability: 'write-data' } : undefined)
  if (access.teamId !== access.caller.currentTeamId)
    throw createError({ statusCode: 404, message: 'Site not found' })
  const remoteSiteId = access.site.gscdumpSiteId
  const host = connectedSiteDomain(access.site)
  if (!remoteSiteId || !host)
    throw createError({ statusCode: 409, message: 'Connect this Site to Search Console first.' })
  const client = createGscdumpPublicV1Client(event, { attempts: 1 })
  let principalId: string | null = null
  await assertLocalRegisteredGscSiteScope(access.db, access.site.id, remoteSiteId, async (id) => {
    const response = await client.getRegisteredHostIdentity({ params: { siteId: id } }).then(response => response.data)
    principalId = response.identity.userId
    return response
  })
  if (!principalId)
    throw createError({ statusCode: 503, message: 'Search Console status is unavailable.' })
  const lifecycle = await client.getUserLifecycle({ params: { userId: principalId } }).then(response => response.data)
  const remote = lifecycle.sites.find(site => site.siteId === remoteSiteId)
  if (!remote?.gscPropertyUrl)
    throw createError({ statusCode: 409, message: 'Connect this Site to Search Console first.' })
  const property = remote.gscPropertyUrl
  return {
    ...access,
    client,
    remoteSiteId,
    property,
    readCandidates: (generationId?: string) => readFirstReportCandidates(host, property, query => client.listSitemapUrls({ params: { siteId: remoteSiteId }, query }).then(response => response.data), generationId),
  }
}

export function firstReportSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  return config.session.password
}
