import type { H3Event } from 'h3'
import type { PageTask } from '../../shared/page-task'
import { logger } from '~~/shared/server/logger'
import { bindPageTask, PAGE_TASK_TTL, readPageTask } from '../../shared/page-task'
import { emitFirstProEvent } from './pro-events'

const key = (userId: number) => `onboarding:page:${userId}`

/** The URL is private. Authenticated return visits read by user, never by a public task ID. */
export async function loadPageTask(event: H3Event) {
  const session = await getUserSession(event)
  const userId = session.user?.id ?? null
  const cookie = readPageTask(session.secure?.pageTask, userId, Date.now())
  if (userId === null)
    return cookie
  const stored = await useStorage('cache').getItem(key(userId)).then(value => readPageTask(value, userId, Date.now())).catch(() => {
    logger.warn('Saved-page storage is unavailable. Reading the sealed browser task.')
    return { _tag: 'Unavailable' as const }
  })
  if (stored._tag === 'Available' && (cookie._tag !== 'Available' || stored.task.createdAt >= cookie.task.createdAt))
    return stored
  if (cookie._tag === 'Available')
    return cookie
  if (stored._tag === 'Unavailable')
    throw new Error('Saved-page storage is unavailable.')
  return cookie._tag === 'Expired' && stored._tag === 'Missing' ? cookie : stored
}

export async function savePageTask(event: H3Event, task: PageTask) {
  // Sealed state survives a private-storage outage. Optional resume must not block sign-in.
  // setUserSession deep-defaults null fields. Replacement must clear the old task's evidence.
  const { id: _sessionId, ...session } = await getUserSession(event)
  await replaceUserSession(event, { ...session, secure: { ...session.secure, pageTask: task } })
  if (task.ownerId !== null) {
    await useStorage('cache').setItem(key(task.ownerId), task, { ttl: Math.ceil(Math.min(PAGE_TASK_TTL, task.expiresAt - Date.now()) / 1000) }).catch(() => logger.warn('Saved-page storage is unavailable. This browser keeps its sealed task.'))
  }
}

/** Only the browser's sealed anonymous task may bind during sign-in. */
export async function claimPageTask(event: H3Event, userId: number) {
  const session = await getUserSession(event)
  const task = bindPageTask(session.secure?.pageTask, userId, Date.now())
  if (task) {
    await savePageTask(event, task)
    await Promise.resolve().then(() => emitFirstProEvent(useDrizzle(event), userId, 'page_task_started', { taskId: task.id })).catch(() => logger.warn('Saved-page progress could not be recorded. Sign-in continues.'))
  }
  else if (session.secure?.pageTask) {
    const { pageTask: _oldTask, ...secure } = session.secure
    const { id: _sessionId, ...data } = session
    await replaceUserSession(event, { ...data, secure })
  }
  return task
}
