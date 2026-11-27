import type { H3Event } from 'h3'
import type { DataForSeoToolId } from '#shared/tool-registry'
import { addWideEventFields } from '@harlan-zw/nuxt-wide-events/server'

export type ToolFailureProvenance = 'rate-limit' | 'budget' | 'validation' | 'provider' | 'internal'

export interface ToolTelemetrySummary {
  cached: boolean
  urlCount?: number
  resultCount?: number
}

export function classifyToolFailure(error: unknown): ToolFailureProvenance {
  if (!error || typeof error !== 'object')
    return 'internal'
  const record = error as { statusCode?: number, status?: number, data?: { code?: string, data?: { code?: string } } }
  const code = record.data?.data?.code ?? record.data?.code
  if (code === 'free_tool_budget_exhausted')
    return 'budget'
  const status = record.statusCode ?? record.status
  if (status === 429)
    return 'rate-limit'
  if (status === 400 || status === 422)
    return 'validation'
  if (status === 502 || status === 503 || status === 504)
    return 'provider'
  return 'internal'
}

export function recordFreeToolWideEvent(
  event: H3Event,
  toolId: DataForSeoToolId,
  outcome: 'success' | 'failure',
  details: ToolTelemetrySummary & { failureProvenance?: ToolFailureProvenance },
): void {
  addWideEventFields(event, {
    'tool.id': toolId,
    'tool.outcome': outcome,
    'tool.cached': details.cached,
    'tool.urlCount': details.urlCount ?? null,
    'tool.resultCount': details.resultCount ?? null,
    'tool.failureProvenance': details.failureProvenance ?? null,
  })
}

export function createBudgetExhaustedError(message: string) {
  return createError({
    statusCode: 429,
    message,
    data: { code: 'free_tool_budget_exhausted' },
  })
}
