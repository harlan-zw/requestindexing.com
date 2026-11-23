import type { FirstReportSaved } from '../../../../../shared/first-report'
import { setHeader } from 'h3'
import { defineProApiHandler } from '#layers/pro-saas/server/utils/handler'
import { firstReportWithoutVerdicts } from '../../../../../shared/first-report'
import { signFirstReportPlan } from '../../../../utils/first-report'
import { firstReportSecret, requireFirstReportSite } from '../../../../utils/first-report-site'

// The First Site report's first read: saved Google verdicts, then the engine's
// URL Inspection status when there are none. It spends no URL Inspection.
export default defineProApiHandler(async (event): Promise<FirstReportSaved> => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const access = await requireFirstReportSite(event)
  const saved = await access.readSaved()
  if (saved._tag === 'Unknown')
    return saved
  if (saved._tag === 'None')
    return firstReportWithoutVerdicts(access.indexing)
  // The plan lets the page record the evidence view after it renders these rows.
  const token = await signFirstReportPlan({ _tag: 'Saved', userId: access.caller.user.id, teamId: access.teamId, siteId: access.site.id, remoteSiteId: access.remoteSiteId, property: access.property, count: saved.rows.length, expiresAt: Date.now() + 10 * 60 * 1000 }, firstReportSecret(event))
  return { _tag: 'Verdicts', rows: saved.rows, token }
})
