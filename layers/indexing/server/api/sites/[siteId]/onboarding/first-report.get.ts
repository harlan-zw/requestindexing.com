import { setHeader } from 'h3'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { can } from '#layers/pro-saas/shared/policies/team-policy'
import { signFirstReportPlan } from '../../../../utils/first-report'
import { firstReportSecret, requireFirstReportSite } from '../../../../utils/first-report-site'

export default defineProApiHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const access = await requireFirstReportSite(event)
  const preview = await access.readCandidates()
  if (preview._tag !== 'Ready')
    return preview
  const token = await signFirstReportPlan({ userId: access.caller.user.id, teamId: access.teamId, siteId: access.site.id, remoteSiteId: access.remoteSiteId, property: access.property, generationId: preview.generationId, urls: preview.urls, expiresAt: Date.now() + 10 * 60 * 1000 }, firstReportSecret(event))
  return { _tag: 'Ready' as const, urls: preview.urls, token, observedAt: preview.observedAt, canInspect: can(access, 'write-data') }
})
