import { desc, gte, like } from 'drizzle-orm'
import { DEFAULT_DAILY_BUDGET_USD } from '~~/layers/core/server/app/services/dataforseo-spend'
import { summarizeToolTelemetry } from '../../../../shared/tools-summary'

const ALLOWED_DAYS = new Set([1, 7, 30])

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)

  const query = getQuery(event)
  const requestedDays = Number(query.days ?? 7)
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 7
  const cutoff = new Date(Date.now() - days * 86_400_000)

  const config = useRuntimeConfig().dataforseo as { dailyBudgetUsd?: string } | undefined
  const configuredBudget = Number(config?.dailyBudgetUsd)
  const dailyBudgetUsd = Number.isFinite(configuredBudget) && configuredBudget > 0
    ? configuredBudget
    : DEFAULT_DAILY_BUDGET_USD

  const db = useDrizzle(event)

  const [requests, feedbackRows] = await Promise.all([
    db
      .select({
        tool: tables.dataforseoRequests.tool,
        endpoint: tables.dataforseoRequests.endpoint,
        taskCount: tables.dataforseoRequests.taskCount,
        status: tables.dataforseoRequests.status,
        httpStatus: tables.dataforseoRequests.httpStatus,
        costUsdMicros: tables.dataforseoRequests.costUsdMicros,
        ipHash: tables.dataforseoRequests.ipHash,
        createdAt: tables.dataforseoRequests.createdAt,
      })
      .from(tables.dataforseoRequests)
      .where(gte(tables.dataforseoRequests.createdAt, cutoff))
      .orderBy(desc(tables.dataforseoRequests.createdAt))
      .all(),
    db
      .select({
        id: tables.feedback.feedbackId,
        path: tables.feedback.path,
        thumb: tables.feedback.thumb,
        comment: tables.feedback.comment,
        createdAt: tables.feedback.createdAt,
      })
      .from(tables.feedback)
      .where(like(tables.feedback.path, '/tools/%'))
      .orderBy(desc(tables.feedback.createdAt))
      .limit(200)
      .all(),
  ])

  return summarizeToolTelemetry({
    days,
    requests,
    feedbackRows,
    dailyBudgetUsd,
  })
})
