import { createError, readBody } from 'h3'
import { assertGscdumpBrowserUnsafeMethodOrigin } from '#layers/pro-gsc/server/utils/gscdump-browser-origin'
import { createPageTask } from '../../../shared/page-task'
import { savePageTask } from '../../utils/page-task'
import { emitFirstProEvent } from '../../utils/pro-events'

export default defineEventHandler(async (event) => {
  assertGscdumpBrowserUnsafeMethodOrigin(event)
  const body: unknown = await readBody(event)
  const session = await getUserSession(event)
  const result = createPageTask(body && typeof body === 'object' ? (body as Record<string, unknown>).url : undefined, session.user?.id ?? null, Date.now(), crypto.randomUUID())
  if (result._tag === 'Err')
    throw createError({ statusCode: 400, message: result.message })
  await savePageTask(event, result.task)
  if (session.user)
    await emitFirstProEvent(useDrizzle(event), session.user.id, 'page_task_started', { taskId: result.task.id })
  return { ok: true }
})
