import type { TaskMap, TaskName } from '#shared/types/tasks'
import type { AppEventName, EventContextMap } from '../utils/event-service'
import { definePlugin } from 'nitro'
import { useNitroHooks } from 'nitro/app'
import { queueJob } from '../utils/event-service'

interface JobInsertOpts { siteId?: string, userId?: number }

function listener<T extends AppEventName>(
  tasks: (TaskName | [TaskName, (ctx: EventContextMap[T]) => boolean])[],
  payloadTransformer: (ctx: EventContextMap[T]) => { payload: TaskMap[TaskName], opts: JobInsertOpts },
) {
  return async (ctx: EventContextMap[T]) => {
    const db = useDrizzle()
    const env = ctx.env ?? {}
    await Promise.all(tasks.map(async (task) => {
      const taskName = typeof task === 'string' ? task : task[0]
      const filter = typeof task === 'string' ? () => true : task[1]
      if (!filter(ctx))
        return

      const { payload, opts } = payloadTransformer(ctx)
      return queueJob(db, env, taskName, payload, opts)
    }))
  }
}

export default definePlugin(() => {
  const hooks = useNitroHooks()
  hooks.hook('app:team:sites-selected', listener<'app:team:sites-selected'>([
    'teams/sync-selected',
  ], ctx => ({
    payload: { teamId: ctx.teamId },
    opts: {},
  })))

  hooks.hook('app:site:created', listener<'app:site:created'>([
    ['sites/setup', ctx => ctx.permissionLevel !== 'siteUnverifiedUser'],
  ], ctx => ({
    payload: { siteId: ctx.siteId },
    opts: { siteId: ctx.siteId },
  })))
})
