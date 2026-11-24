import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'
import { dispatchToQueue } from '~~/layers/core/server/utils/event-service'
import { retryFailedJob } from '~~/layers/core/server/utils/jobs'

export default defineEventHandler(async (e) => {
  await requireAdminAuth(e)
  const { jobId } = getRouterParams(e, { decode: true })
  const db = useDrizzle()
  const env = resolveCloudflareBindings<Record<string, unknown>>(e) ?? {}

  const result = await retryFailedJob(db, jobId!)
  if (result) {
    await dispatchToQueue(env, result.id, result.queue)
    return 'OK'
  }
  return '404'
})
