import { and, eq } from 'drizzle-orm'
import { setHeader } from 'h3'
import { savedPageMatchesHost } from '../../../shared/page-task'
import { connectedSiteDomain } from '../../../shared/site-url'
import { sites } from '../../database'
import { loadPageTask } from '../../utils/page-task'
import { requireCurrentTeam } from '../../utils/require-current-team'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const read = await loadPageTask(event)
  if (read._tag !== 'Available')
    return read
  const { task } = read
  const session = await getUserSession(event)
  if (!session.user)
    return { _tag: 'Available' as const, url: task.url, host: new URL(task.url).hostname, siteId: null, canInspect: false }
  const ctx = await requireCurrentTeam(event)
  const candidates = await ctx.db.select().from(sites).where(and(eq(sites.teamId, ctx.team.teamId)))
  const site = candidates.find(site => savedPageMatchesHost(task.url, connectedSiteDomain(site) ?? ''))
  return { _tag: 'Available' as const, url: task.url, host: new URL(task.url).hostname, siteId: site?.publicId ?? null, canInspect: ctx.can('write-data') }
})
