import { FREE_TOOLS, getFreeToolByApiId } from '~~/shared/tool-registry'

export interface DataForSeoRequestSample {
  tool: string
  endpoint: string
  taskCount: number
  status: 'ok' | 'http_error'
  httpStatus: number | null
  costUsdMicros: number | null
  ipHash: string | null
  createdAt: Date | number | string | null
}

export interface ToolFeedbackSample {
  id: number
  path: string
  thumb: 'up' | 'down' | null
  comment: string | null
  createdAt: Date | number | string | null
}

export interface ToolBreakdownRow {
  apiToolId: string
  title: string
  path: string | null
  calls: number
  tasks: number
  errors: number
  errorRatePct: number
  spendUsd: number
  uniqueCallers: number
  thumbsUp: number
  thumbsDown: number
}

export interface ToolDailyRow {
  day: string
  calls: number
  tasks: number
  errors: number
  spendUsd: number
}

export interface ToolRecentComment {
  id: number
  path: string
  comment: string
  createdAt: string | null
}

export interface ToolsTelemetrySummary {
  days: number
  totals: {
    calls: number
    tasks: number
    errors: number
    errorRatePct: number
    spendUsd: number
    uniqueCallers: number
    todaySpendUsd: number
    dailyBudgetUsd: number
    todayBudgetUsedPct: number
    thumbsUp: number
    thumbsDown: number
  }
  byTool: ToolBreakdownRow[]
  daily: ToolDailyRow[]
  recentComments: ToolRecentComment[]
}

const USD_MICROS = 1_000_000

function toIsoDate(value: Date | number | string | null): Date | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value : null
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    return Number.isFinite(d.getTime()) ? d : null
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

function roundUsd(micros: number): number {
  return Math.round((micros / USD_MICROS) * 10_000) / 10_000
}

function errorRate(errors: number, calls: number): number {
  if (calls === 0)
    return 0
  return Math.round((errors / calls) * 1000) / 10
}

function apiToolIdFromFeedbackPath(path: string): string | null {
  const match = FREE_TOOLS.find(tool => path === tool.path || path.startsWith(`${tool.path}/`))
  return match?.apiToolId ?? null
}

export function summarizeToolTelemetry(input: {
  days: number
  requests: DataForSeoRequestSample[]
  feedbackRows: ToolFeedbackSample[]
  dailyBudgetUsd: number
  now?: Date
}): ToolsTelemetrySummary {
  const now = input.now ?? new Date()
  const todayUtc = now.toISOString().slice(0, 10)

  const callersAll = new Set<string>()
  let totalCalls = 0
  let totalTasks = 0
  let totalErrors = 0
  let totalSpendMicros = 0
  let todaySpendMicros = 0

  interface ToolAcc {
    calls: number
    tasks: number
    errors: number
    spendMicros: number
    callers: Set<string>
    thumbsUp: number
    thumbsDown: number
  }

  const byToolMap = new Map<string, ToolAcc>()
  for (const tool of FREE_TOOLS) {
    byToolMap.set(tool.apiToolId, {
      calls: 0,
      tasks: 0,
      errors: 0,
      spendMicros: 0,
      callers: new Set<string>(),
      thumbsUp: 0,
      thumbsDown: 0,
    })
  }

  const dailyMap = new Map<string, { calls: number, tasks: number, errors: number, spendMicros: number }>()

  for (const req of input.requests) {
    totalCalls += 1
    totalTasks += req.taskCount
    const isErr = req.status !== 'ok'
    if (isErr)
      totalErrors += 1
    const cost = req.costUsdMicros ?? 0
    totalSpendMicros += cost
    if (req.ipHash)
      callersAll.add(req.ipHash)

    let acc = byToolMap.get(req.tool)
    if (!acc) {
      acc = { calls: 0, tasks: 0, errors: 0, spendMicros: 0, callers: new Set<string>(), thumbsUp: 0, thumbsDown: 0 }
      byToolMap.set(req.tool, acc)
    }
    acc.calls += 1
    acc.tasks += req.taskCount
    if (isErr)
      acc.errors += 1
    acc.spendMicros += cost
    if (req.ipHash)
      acc.callers.add(req.ipHash)

    const date = toIsoDate(req.createdAt)
    if (date) {
      const day = date.toISOString().slice(0, 10)
      if (day === todayUtc)
        todaySpendMicros += cost
      const dayAcc = dailyMap.get(day) ?? { calls: 0, tasks: 0, errors: 0, spendMicros: 0 }
      dayAcc.calls += 1
      dayAcc.tasks += req.taskCount
      if (isErr)
        dayAcc.errors += 1
      dayAcc.spendMicros += cost
      dailyMap.set(day, dayAcc)
    }
  }

  let thumbsUp = 0
  let thumbsDown = 0
  const recentComments: ToolRecentComment[] = []

  for (const row of input.feedbackRows) {
    const apiToolId = apiToolIdFromFeedbackPath(row.path)
    const acc = apiToolId ? byToolMap.get(apiToolId) : undefined
    if (row.thumb === 'up') {
      thumbsUp += 1
      if (acc)
        acc.thumbsUp += 1
    }
    else if (row.thumb === 'down') {
      thumbsDown += 1
      if (acc)
        acc.thumbsDown += 1
    }

    if (row.comment?.trim() && recentComments.length < 25) {
      const created = toIsoDate(row.createdAt)
      recentComments.push({
        id: row.id,
        path: row.path,
        comment: row.comment.trim(),
        createdAt: created ? created.toISOString() : null,
      })
    }
  }

  const byTool: ToolBreakdownRow[] = [...byToolMap.entries()].map(([apiToolId, acc]) => {
    const meta = getFreeToolByApiId(apiToolId)
    return {
      apiToolId,
      title: meta?.title ?? apiToolId,
      path: meta?.path ?? null,
      calls: acc.calls,
      tasks: acc.tasks,
      errors: acc.errors,
      errorRatePct: errorRate(acc.errors, acc.calls),
      spendUsd: roundUsd(acc.spendMicros),
      uniqueCallers: acc.callers.size,
      thumbsUp: acc.thumbsUp,
      thumbsDown: acc.thumbsDown,
    }
  })

  const daily: ToolDailyRow[] = [...dailyMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, acc]) => ({
      day,
      calls: acc.calls,
      tasks: acc.tasks,
      errors: acc.errors,
      spendUsd: roundUsd(acc.spendMicros),
    }))

  const todaySpendUsd = roundUsd(todaySpendMicros)
  const todayBudgetUsedPct = input.dailyBudgetUsd > 0
    ? Math.min(100, Math.round((todaySpendUsd / input.dailyBudgetUsd) * 1000) / 10)
    : 0

  return {
    days: input.days,
    totals: {
      calls: totalCalls,
      tasks: totalTasks,
      errors: totalErrors,
      errorRatePct: errorRate(totalErrors, totalCalls),
      spendUsd: roundUsd(totalSpendMicros),
      uniqueCallers: callersAll.size,
      todaySpendUsd,
      dailyBudgetUsd: input.dailyBudgetUsd,
      todayBudgetUsedPct,
      thumbsUp,
      thumbsDown,
    },
    byTool,
    daily,
    recentComments,
  }
}
