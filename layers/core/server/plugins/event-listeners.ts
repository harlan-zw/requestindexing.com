import type { NitroRuntimeHooks } from 'nitropack'
import type { TaskMap, TaskName } from '#shared/types/tasks'
import { queueJob } from '../utils/event-service'

interface JobInsertOpts { siteId?: string, userId?: number }

function listeners<T extends keyof NitroRuntimeHooks>(
  hookName: T,
  tasks: (TaskName | [TaskName, (ctx: Parameters<NitroRuntimeHooks[T]>[number]) => boolean])[],
  payloadTransformer: (ctx: Parameters<NitroRuntimeHooks[T]>[number]) => { payload: TaskMap[TaskName], opts: JobInsertOpts },
) {
  return {
    [hookName]: async (ctx: Parameters<NitroRuntimeHooks[T]>[number]) => {
      const db = useDrizzle()
      const env = (ctx as Record<string, unknown>).env as Record<string, unknown> ?? {}

      await Promise.all(
        tasks.map(async (task) => {
          const taskName = typeof task === 'string' ? task : task[0]
          const filter = typeof task === 'string' ? () => true : task[1]
          if (!filter(ctx))
            return

          const { payload, opts } = payloadTransformer(ctx)
          return queueJob(db, env, taskName, payload, opts)
        }),
      )
    },
  }
}

export default defineNitroPlugin(async (nitro) => {
  nitro.hooks.addHooks({
    ...listeners('app:team:sites-selected', [
      'teams/sync-selected',
    ], ctx => ({
      payload: { teamId: ctx.teamId },
      opts: {},
    })),

    ...listeners('app:site:created', [
      ['sites/setup', ctx => ctx.permissionLevel !== 'siteUnverifiedUser'],
    ], ctx => ({
      payload: { siteId: ctx.siteId },
      opts: { siteId: ctx.siteId },
    })),
  })
})
