// Typed error taxonomy + wire envelope shared between server, app, and shared code.

export type ProErrorCode
  = | 'unauthorized'
    | 'forbidden'
    | 'team_not_found'
    | 'team_forbidden'
    | 'membership_required'
    | 'invitation_invalid'
    | 'invitation_expired'
    | 'rate_limited'
    | 'validation_failed'
    | 'idempotency_conflict'
    | 'not_found'
    | 'conflict'
    | 'search_console_required'
    | 'internal_error'

interface ProErrorDefaults {
  statusCode: number
  message: string
}

const DEFAULTS: Record<ProErrorCode, ProErrorDefaults> = {
  unauthorized: { statusCode: 401, message: 'Unauthorized' },
  forbidden: { statusCode: 403, message: 'Forbidden' },
  team_not_found: { statusCode: 404, message: 'Team not found' },
  team_forbidden: { statusCode: 403, message: 'Team access denied' },
  membership_required: { statusCode: 403, message: 'Team membership required' },
  invitation_invalid: { statusCode: 400, message: 'Invitation is invalid' },
  invitation_expired: { statusCode: 410, message: 'Invitation has expired' },
  rate_limited: { statusCode: 429, message: 'Rate limited' },
  validation_failed: { statusCode: 400, message: 'Validation failed' },
  idempotency_conflict: { statusCode: 409, message: 'Idempotency conflict' },
  not_found: { statusCode: 404, message: 'Not found' },
  conflict: { statusCode: 409, message: 'Conflict' },
  search_console_required: { statusCode: 409, message: 'Connect Search Console first.' },
  internal_error: { statusCode: 500, message: 'Internal error' },
}

export interface ProErrorOptions {
  message?: string
  statusCode?: number
  details?: Record<string, unknown>
  cause?: unknown
}

export class ProError extends Error {
  readonly code: ProErrorCode
  readonly statusCode: number
  readonly details?: Record<string, unknown>

  constructor(code: ProErrorCode, options: ProErrorOptions = {}) {
    const defaults = DEFAULTS[code]
    super(options.message ?? defaults.message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'ProError'
    this.code = code
    this.statusCode = options.statusCode ?? defaults.statusCode
    this.details = options.details
  }
}

export function isProError(e: unknown): e is ProError {
  return e instanceof ProError
}

export interface ProErrorEnvelope {
  code: ProErrorCode
  message: string
  requestId: string
  details?: Record<string, unknown>
}

/**
 * The message a refused Pro API call carries, or null. `defineProApiHandler`
 * throws `createError({ data: envelope })`, and ofetch puts the h3 error body
 * on `error.data`, so the envelope's message is at `error.data.data.message`.
 * `error.data.message` is only the error code.
 */
export function readProErrorMessage(error: unknown): string | null {
  const message = (error as { data?: { data?: { message?: unknown } } } | null)?.data?.data?.message
  return typeof message === 'string' && message ? message : null
}
