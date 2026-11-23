// H3 handler wrappers: request-id propagation, ProError envelope conversion, idempotency caching.

import type { ConsolaInstance } from 'consola'
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { ZodError, ZodTypeAny } from 'zod'
import type { Caller } from '../../shared/caller'
import type { ProErrorCode, ProErrorEnvelope } from '../../shared/errors'
import type { Ability } from '../../shared/policies/team-policy'
import type { CurrentTeamContext } from './require-current-team'
import type { RequireSiteAccessOptions } from './require-site-access'
import { createConsola } from 'consola'
import { logError } from '~~/shared/logging'
import { ProError } from '../../shared/errors'
import { getCaller, requireCaller } from './get-caller'
import { requireCurrentTeam } from './require-current-team'
import { requireSiteAccess } from './require-site-access'
import { markCapturedBySentry } from './sentry-captured'

declare module 'h3' {
  interface H3EventContext {
    __caller?: Caller
    logger?: ConsolaInstance
    requestId?: string
  }
}

function statusToProCode(status: number): ProErrorCode {
  switch (status) {
    case 400: return 'validation_failed'
    case 401: return 'unauthorized'
    case 403: return 'forbidden'
    case 404: return 'not_found'
    case 409: return 'conflict'
    case 410: return 'invitation_expired'
    case 422: return 'validation_failed'
    case 429: return 'rate_limited'
    default: return status >= 500 ? 'internal_error' : 'forbidden'
  }
}

const baseLogger = createConsola({ defaults: { tag: 'pro-api' } })

function createLogger(event: H3Event, requestId: string): ConsolaInstance {
  const callerId = event.context.__caller?.user.id
  const teamId = event.context.__caller?.currentTeamId
  const tag = ['pro-api', requestId.slice(0, 8), callerId, teamId].filter(Boolean).join(':')
  return baseLogger.withTag(tag)
}

export function getProLogger(event: H3Event): ConsolaInstance {
  const existing = event.context.logger
  if (existing)
    return existing
  const requestId = ensureRequestId(event)
  const logger = createLogger(event, requestId)
  event.context.logger = logger
  return logger
}

function ensureRequestId(event: H3Event): string {
  const existing = event.context.requestId as string | undefined
  if (existing)
    return existing
  const id = crypto.randomUUID()
  event.context.requestId = id
  return id
}

interface H3StyleError {
  statusCode: number
  statusMessage?: string
  data?: unknown
  message?: string
}

function isH3StyleError(error: unknown): error is H3StyleError {
  return typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

// Options-bag form of defineProApiHandler. Absorbs the per-route prelude
// (caller / subscription / team / body) into one declaration so handler bodies
// stay focused on the business logic. Each prelude step is opt-in; the resulting
// `ctx` is typed conditional on the options.
export interface ProHandlerTeamOptions {
  ability?: Ability
  teamId?: number
}

export interface ProHandlerOptions<B extends ZodTypeAny = ZodTypeAny> {
  /** Resolve `requireCaller(event)` and put it on `ctx.caller`. Default true. */
  caller?: boolean
  /** Resolve `requireCurrentTeam(event, opts)` and put it on `ctx.team`. */
  team?: boolean | ProHandlerTeamOptions
  /** Resolve `requireSiteAccess(event, opts)` and put it on `ctx.site`. */
  site?: boolean | RequireSiteAccessOptions
  /** Validate body via `readProValidatedBody(event, schema)` and put it on `ctx.body`. */
  body?: B
}

export interface ProHandlerCtxBase {
  event: H3Event
  db: ReturnType<typeof useDrizzle>
}

// Conditional `ctx` shape derived from the supplied options. Routes that opt
// into `team` get a non-null `team`; routes that supply `body` get a typed
// payload; routes that disable `caller` get `Caller | null`.
export type ProHandlerCtx<O extends ProHandlerOptions>
  = ProHandlerCtxBase
    & {
      caller: O extends { caller: false } ? Caller | null : Caller
    }
    & (O extends { team: ProHandlerTeamOptions | true }
      ? { team: CurrentTeamContext }
      : { team?: undefined })
    & (O extends { site: RequireSiteAccessOptions | true }
      ? { site: Awaited<ReturnType<typeof requireSiteAccess>> }
      : { site?: undefined })
    & (O extends { body: infer S extends ZodTypeAny }
      ? { body: import('zod').z.infer<S> }
      : { body?: undefined })

async function buildHandlerCtx<O extends ProHandlerOptions>(
  event: H3Event,
  options: O,
): Promise<ProHandlerCtx<O>> {
  const ctx = { event, db: useDrizzle(event) } as Record<string, unknown>
  const preludeResolvesCaller = !!options.team || !!options.site

  // Caller defaults to required; opt out with `caller: false`.
  if (options.caller !== false && !preludeResolvesCaller) {
    ctx.caller = await requireCaller(event)
  }
  else if (options.caller === false) {
    ctx.caller = await getCaller(event)
  }

  if (options.team) {
    const teamOpts = options.team === true ? undefined : options.team
    ctx.team = await requireCurrentTeam(event, teamOpts)
    // Reuse the team's caller (already loaded; same per-request cache) so we
    // don't double-resolve when both caller + team are requested.
    if (!ctx.caller)
      ctx.caller = (ctx.team as CurrentTeamContext).caller
  }

  if (options.site) {
    const siteOpts = options.site === true ? undefined : options.site
    ctx.site = await requireSiteAccess(event, siteOpts)
    ctx.caller = (ctx.site as Awaited<ReturnType<typeof requireSiteAccess>>).caller
  }

  if (options.body)
    ctx.body = await readProValidatedBody(event, options.body)

  return ctx as ProHandlerCtx<O>
}

type HandlerMode<O extends ProHandlerOptions, T>
  = | { _tag: 'event', handler: (event: H3Event) => T | Promise<T> }
    | { _tag: 'context', options: O, handler: (ctx: ProHandlerCtx<O>) => T | Promise<T> }

function createProHandler<O extends ProHandlerOptions, T>(mode: HandlerMode<O, T>): EventHandler<EventHandlerRequest, Promise<T>> {
  return defineEventHandler(async (event) => {
    const requestId = ensureRequestId(event)
    setResponseHeader(event, 'x-request-id', requestId)
    event.context.logger ??= createLogger(event, requestId)
    try {
      if (mode._tag === 'context') {
        const ctx = await buildHandlerCtx(event, mode.options)
        return await mode.handler(ctx)
      }
      return await mode.handler(event)
    }
    catch (e) {
      if (e instanceof ProError) {
        const envelope: ProErrorEnvelope = {
          code: e.code,
          message: e.message,
          requestId,
          ...(e.details ? { details: e.details } : {}),
        }
        throw createError({
          statusCode: e.statusCode,
          statusMessage: e.code,
          data: envelope,
        })
      }
      if (isH3StyleError(e)) {
        const data = asRecord(e.data)
        if (typeof data.code === 'string' && typeof data.requestId === 'string')
          throw e
        const code = statusToProCode(e.statusCode)
        const message = typeof data.message === 'string' ? data.message : e.statusMessage ?? e.message ?? code
        e.data = {
          ...data,
          code,
          message,
          requestId,
        } satisfies ProErrorEnvelope
        throw e
      }
      const caller = event.context.__caller
      logError('handler.unhandled_error', e, {
        requestId,
        ...(caller ? { userId: caller.user.id, teamId: caller.currentTeamId } : {}),
      })
      const cause = markCapturedBySentry(e)
      throw createError({
        statusCode: 500,
        statusMessage: 'internal_error',
        data: {
          code: 'internal_error',
          message: 'Internal error',
          requestId,
        } satisfies ProErrorEnvelope,
        cause,
      })
    }
  })
}

export function defineProApiHandler<T>(fn: (event: H3Event) => T | Promise<T>): EventHandler<EventHandlerRequest, Promise<T>>
export function defineProApiHandler<O extends ProHandlerOptions, T>(
  options: O,
  fn: (ctx: ProHandlerCtx<O>) => T | Promise<T>,
): EventHandler<EventHandlerRequest, Promise<T>>
export function defineProApiHandler<O extends ProHandlerOptions, T>(
  fnOrOptions: ((event: H3Event) => T | Promise<T>) | O,
  maybeFn?: (ctx: ProHandlerCtx<O>) => T | Promise<T>,
): EventHandler<EventHandlerRequest, Promise<T>> {
  if (typeof fnOrOptions === 'function')
    return createProHandler({ _tag: 'event', handler: fnOrOptions })
  if (!maybeFn)
    throw new TypeError('The options form requires a handler function.')
  return createProHandler({ _tag: 'context', options: fnOrOptions, handler: maybeFn })
}

/**
 * Read + validate a JSON body against a Zod schema. ZodErrors become
 * `ProError('validation_failed')` with `{ issues }` details, so routes get the
 * envelope without per-route try/catch around `readValidatedBody`.
 */
export async function readProValidatedBody<S extends ZodTypeAny>(
  event: H3Event,
  schema: S,
): Promise<import('zod').z.infer<S>> {
  // Safe: a parse error becomes `undefined`, which zod then rejects with the
  // canonical `validation_failed` envelope below.
  const body = await readBody(event).catch(() => undefined)
  const result = schema.safeParse(body)
  if (!result.success) {
    const err = result.error as ZodError
    throw new ProError('validation_failed', {
      details: { issues: err.issues },
    })
  }
  return result.data
}

interface IdempotencyOptions {
  ttlSeconds?: number
  scope?: string
}

interface IdempotencyEntry<T> {
  status: 'pending' | 'complete'
  startedAt?: number
  result?: T
}

const PENDING_TIMEOUT_MS = 30_000

async function runIdempotent<T>(
  event: H3Event,
  callerId: number | undefined,
  options: IdempotencyOptions,
  fn: () => T | Promise<T>,
): Promise<T> {
  const idempotencyKey = getRequestHeader(event, 'idempotency-key')
  if (!idempotencyKey)
    return await fn()

  const scope = options.scope ?? '*'
  const cacheKey = `pro:idempotency:${scope}:${callerId ?? 'anon'}:${idempotencyKey}`
  const storage = useStorage('cache')

  const existing = await storage.getItem<IdempotencyEntry<T>>(cacheKey)
  if (existing) {
    if (existing.status === 'complete')
      return existing.result as T
    if (existing.status === 'pending' && existing.startedAt && (Date.now() - existing.startedAt) < PENDING_TIMEOUT_MS)
      throw new ProError('idempotency_conflict')
  }

  await storage.setItem(cacheKey, { status: 'pending', startedAt: Date.now() } satisfies IdempotencyEntry<T>)

  try {
    const result = await fn()
    await storage.setItem(cacheKey, { status: 'complete', result } satisfies IdempotencyEntry<T>)
    await storage.setMeta(cacheKey, { ttl: options.ttlSeconds ?? 86_400 })
    return result
  }
  catch (e) {
    await storage.removeItem(cacheKey)
    throw e
  }
}

export function defineIdempotentHandler<T>(
  fn: (event: H3Event) => T | Promise<T>,
  options?: IdempotencyOptions,
): EventHandler<EventHandlerRequest, Promise<T>>
export function defineIdempotentHandler<O extends ProHandlerOptions, T>(
  handlerOptions: O,
  fn: (ctx: ProHandlerCtx<O>) => T | Promise<T>,
  options?: IdempotencyOptions,
): EventHandler<EventHandlerRequest, Promise<T>>
export function defineIdempotentHandler<O extends ProHandlerOptions, T>(
  fnOrHandlerOptions: ((event: H3Event) => T | Promise<T>) | O,
  maybeFnOrOptions?: ((ctx: ProHandlerCtx<O>) => T | Promise<T>) | IdempotencyOptions,
  maybeOptions?: IdempotencyOptions,
) {
  if (typeof fnOrHandlerOptions === 'function') {
    const fn = fnOrHandlerOptions
    const options = (maybeFnOrOptions ?? {}) as IdempotencyOptions
    return defineProApiHandler<T>(async (event) => {
      const callerId = event.context.__caller?.user.id
      return await runIdempotent(event, callerId, options, () => fn(event))
    })
  }

  const handlerOptions = fnOrHandlerOptions
  const fn = maybeFnOrOptions as (ctx: ProHandlerCtx<O>) => T | Promise<T>
  const options = maybeOptions ?? {}
  return defineProApiHandler(handlerOptions, async (ctx) => {
    const callerId = ctx.caller?.user.id
    return await runIdempotent(ctx.event, callerId, options, () => fn(ctx))
  })
}
