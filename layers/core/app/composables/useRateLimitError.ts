import type { ErrorStateSource } from '@nuxtseo/design-system/app/shared/error-state'
import { errorCopy, rateLimited } from '@nuxtseo/design-system/app/shared/error-state'

export interface RateLimitInfo {
  isRateLimited: boolean
  isBudgetExhausted: boolean
  message: string
  limit?: number
  remaining?: number
  resetAt?: Date
  retryAfter?: number
}

export interface ToolError {
  message: string
  rateLimitInfo?: RateLimitInfo
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function errorData(err: unknown): Record<string, unknown> | undefined {
  if (!isRecord(err))
    return undefined
  return isRecord(err.data) ? err.data : undefined
}

function errorStatusCode(err: unknown): number | undefined {
  if (!isRecord(err))
    return undefined
  const data = errorData(err)
  return toNumber(err.statusCode) ?? toNumber(data?.statusCode) ?? toNumber(err.status)
}

function errorCode(err: unknown): string | undefined {
  const data = errorData(err)
  const nested = isRecord(data?.data) ? data.data : undefined
  return toString(nested?.code) ?? toString(data?.code)
}

// ofetch writes `[POST] "/api/tools/...": 500 Internal Server Error` into
// `err.message`. Never surface that wire string to visitors.
const OFETCH_WIRE_MESSAGE = /^\[\w+\]\s+"/

const GENERIC_TOOL_MESSAGE = 'The check could not finish. Try again in a moment.'

function errorMessage(err: unknown): string {
  if (!isRecord(err))
    return GENERIC_TOOL_MESSAGE
  const data = errorData(err)
  const raw = toString(data?.message) ?? toString(err.message)
  if (!raw || OFETCH_WIRE_MESSAGE.test(raw))
    return GENERIC_TOOL_MESSAGE
  return raw
}

function getHeader(headers: unknown, key: string): string | undefined {
  if (headers instanceof Headers)
    return headers.get(key) ?? undefined
  if (!isRecord(headers))
    return undefined
  const value = headers[key] ?? headers[key.toLowerCase()]
  if (typeof value === 'string')
    return value
  if (typeof value === 'number')
    return String(value)
  return undefined
}

function errorHeaders(err: unknown): unknown {
  if (!isRecord(err))
    return undefined
  const response = isRecord(err.response) ? err.response : undefined
  return response?.headers ?? err.headers
}

export function parseRateLimitError(err: unknown): ToolError {
  const statusCode = errorStatusCode(err)
  const code = errorCode(err)
  const message = errorMessage(err)

  const isBudgetExhausted = code === 'free_tool_budget_exhausted'
  if (statusCode !== 429 && !isBudgetExhausted) {
    return { message }
  }

  const headers = errorHeaders(err)
  const limit = toNumber(getHeader(headers, 'x-ratelimit-limit'))
  const remaining = toNumber(getHeader(headers, 'x-ratelimit-remaining'))
  const resetTimestamp = toNumber(getHeader(headers, 'x-ratelimit-reset'))
  const retryAfter = toNumber(getHeader(headers, 'retry-after'))

  let resetAt: Date | undefined
  if (resetTimestamp) {
    resetAt = new Date(resetTimestamp * 1000)
  }
  else if (retryAfter) {
    resetAt = new Date(Date.now() + retryAfter * 1000)
  }

  return {
    message,
    rateLimitInfo: {
      isRateLimited: true,
      isBudgetExhausted,
      message,
      limit,
      remaining,
      resetAt,
      retryAfter,
    },
  }
}

export function toolErrorState(error: string | ToolError | null): ErrorStateSource | null {
  if (!error)
    return null
  if (typeof error === 'string')
    return errorCopy(error)

  const info = error.rateLimitInfo
  if (info?.isRateLimited)
    return rateLimited(error.message, { resetAt: info.resetAt, retryAfter: info.retryAfter })

  return errorCopy(error.message)
}
