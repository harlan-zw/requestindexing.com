import { CommentFeedbackSchema } from '@nuxtseo/design-system/shared/contracts/feedback'
import { parseURL } from 'ufo'
import { checkAnonymousFeedbackRateLimit } from '#layers/pro-saas/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  await checkAnonymousFeedbackRateLimit(event, 'comment')
  const body = await readValidatedBody(event, CommentFeedbackSchema.parse)
  const { comment, context, toolId } = body
  const referrerPath = parseURL(getHeader(event, 'referer') || '/').pathname || '/'
  const path = toolId ? `/tools/${toolId}` : referrerPath

  const db = useDrizzle(event)
  await db.insert(tables.feedback).values({
    path,
    comment,
    metadata: {
      source: toolId ? 'tool-feedback' : 'site-feedback',
      ...(toolId ? { toolId } : {}),
      ...(context ? { context } : {}),
    },
  })

  return { ok: true }
})
