import type { PartnerLifecycleResponse } from '#layers/pro-gsc/shared/gscdump-api'
import type { FollowUpProgress } from '../../shared/onboarding-follow-up'
import { eq } from 'drizzle-orm'
import { logger } from '~~/shared/server/logger'
import { pagePropertyCoversUrl, readPageTask, savedPageMatchesHost } from '../../shared/page-task'
import { sites, users } from '../database'

export interface FollowUpRead { progress: FollowUpProgress, resumePage: boolean }

export async function readOnboardingFollowUp(
  deps: { db: ReturnType<typeof useDrizzle>, now: Date, readLifecycle: (id: string) => Promise<PartnerLifecycleResponse>, readTask: (userId: number) => Promise<unknown> },
  userId: number,
): Promise<FollowUpRead> {
  const user = await deps.db.select({ teamId: users.currentTeamId, gscdumpUserId: users.gscdumpUserId, hasKey: users.gscdumpApiKey }).from(users).where(eq(users.userId, userId)).get()
  const rawTask = await deps.readTask(userId)
  const task = readPageTask(rawTask, userId, deps.now.getTime())
  const resumePage = task._tag === 'Available'
  if (!user?.gscdumpUserId || !user.hasKey)
    return { progress: 'google-missing', resumePage }
  const lifecycle = await deps.readLifecycle(user.gscdumpUserId).catch(() => {
    logger.warn('Onboarding follow-up is waiting for Search Console status.')
    return null
  })
  if (!lifecycle)
    return { progress: 'unavailable', resumePage }
  if (lifecycle.account.status !== 'ready')
    return { progress: 'google-missing', resumePage }
  const localSites = await deps.db.select({ engineId: sites.gscdumpSiteId }).from(sites).where(eq(sites.teamId, user.teamId))
  const linked = localSites.some(site => site.engineId && lifecycle.sites.some(remote => remote.siteId === site.engineId && (task._tag !== 'Available' || (savedPageMatchesHost(task.task.url, remote.requestedUrl) && !!remote.gscPropertyUrl && pagePropertyCoversUrl(task.task.url, remote.gscPropertyUrl)))))
  if (!linked)
    return { progress: 'site-missing', resumePage }
  if (task._tag === 'Available' && task.task.evidenceViewedAt === null)
    return { progress: 'evidence-missing', resumePage }
  return { progress: 'ready', resumePage }
}
