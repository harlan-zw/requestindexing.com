import { feedbackIntentSchema, feedbackSentimentSchema } from '@nuxtseo/pro-shell/shared/contracts'
import { z } from 'zod'

export const FEEDBACK_STATUSES = ['new', 'triaged', 'fixing', 'fixed', 'replied', 'closed', 'ignored'] as const
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES)
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>

export const feedbackTriagePatchSchema = z.object({
  status: feedbackStatusSchema.optional(),
  triageNote: z.string().trim().max(1000).nullable().optional(),
  resolutionNote: z.string().trim().max(1000).nullable().optional(),
  fixRef: z.string().trim().max(200).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.status === 'ignored' && !value.triageNote?.trim())
    ctx.addIssue({ code: 'custom', path: ['triageNote'], message: 'Say why this feedback is ignored.' })
})
export type FeedbackTriagePatch = z.infer<typeof feedbackTriagePatchSchema>

// Mirrors `@nuxtseo/pro-shell`'s feedback history contract so Request Indexing
// can re-export directly once `@nuxtseo/pro-shell` ships the history drawer.
export const FEEDBACK_RESOLUTION_STATUSES = ['received', 'in_progress', 'fixed', 'replied', 'closed'] as const
export const feedbackResolutionStatusSchema = z.enum(FEEDBACK_RESOLUTION_STATUSES)
export type FeedbackResolutionStatus = z.infer<typeof feedbackResolutionStatusSchema>

export const feedbackHistoryItemSchema = z.object({
  id: z.string(),
  path: z.string(),
  comment: z.string().nullable(),
  intent: feedbackIntentSchema.nullable(),
  sentiment: feedbackSentimentSchema.nullable(),
  createdAt: z.string().datetime().nullable(),
  resolution: feedbackResolutionStatusSchema,
  resolutionNote: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
})

export const feedbackHistoryResponseSchema = z.object({
  items: z.array(feedbackHistoryItemSchema),
  hasMore: z.boolean(),
})

export type FeedbackHistoryItem = z.infer<typeof feedbackHistoryItemSchema>
export type FeedbackHistoryResponse = z.infer<typeof feedbackHistoryResponseSchema>

export function resolveFeedbackStatus(status: FeedbackStatus | null | undefined): FeedbackResolutionStatus {
  switch (status) {
    case 'triaged':
    case 'fixing':
      return 'in_progress'
    case 'fixed':
      return 'fixed'
    case 'replied':
      return 'replied'
    case 'closed':
    case 'ignored':
      return 'closed'
    default:
      return 'received'
  }
}

export function resolveFeedbackTimestamp(input: {
  readonly resolution: FeedbackResolutionStatus
  readonly fixedAt?: string | null
  readonly repliedAt?: string | null
}): string | null {
  switch (input.resolution) {
    case 'fixed':
      return input.fixedAt ?? null
    case 'replied':
    case 'closed':
      return input.repliedAt ?? input.fixedAt ?? null
    default:
      return null
  }
}
