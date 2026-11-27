import type { ThumbsFeedbackResponse } from '@nuxtseo/design-system/shared/contracts/feedback'
import { ThumbsFeedbackSchema } from '@nuxtseo/design-system/shared/contracts/feedback'
import { sql } from 'drizzle-orm'
import { parseURL } from 'ufo'
import { checkAnonymousFeedbackRateLimit } from '#layers/pro-saas/server/utils/rate-limit'

export default defineEventHandler(async (event): Promise<ThumbsFeedbackResponse> => {
  await checkAnonymousFeedbackRateLimit(event, 'thumbs')
  const body = await readValidatedBody(event, ThumbsFeedbackSchema.parse)
  const { thumbs, toolId, context } = body
  const referrerPath = parseURL(getHeader(event, 'referer') || '/').pathname || '/'
  const path = toolId ? `/tools/${toolId}` : referrerPath

  const db = useDrizzle(event)
  await db.insert(tables.feedback).values({
    path,
    thumb: thumbs,
    metadata: {
      source: toolId ? 'tool-feedback' : 'site-feedback',
      ...(toolId ? { toolId } : {}),
      ...(context ? { context } : {}),
    },
  })

  const stats = await db
    .select({
      up: sql<number>`sum(case when thumb = 'up' then 1 else 0 end)`,
      down: sql<number>`sum(case when thumb = 'down' then 1 else 0 end)`,
    })
    .from(tables.feedback)
    .where(sql`path = ${path} and thumb is not null`)
    .get()

  return {
    thumbs,
    stats: { up: Number(stats?.up || 0), down: Number(stats?.down || 0) },
  }
})
