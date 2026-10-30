import type { AnalysisParams } from '@gscdump/engine/analysis-types'
import type { ComputedRef, MaybeRefOrGetter, Ref, WatchSource } from 'vue'
import { classifyGscError } from '@gscdump/sdk/gsc-error'
import { defaultStringifyOperations, stringify } from 'devalue'
import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import { useGscQueryIdentity } from './useGscQueryIdentity'

export type GscQueryEngine = 'auto' | 'browser' | 'server'

export type GscQueryStatus
  = | 'idle'
    | 'pending'
    | 'success'
    | 'empty'
    | 'error'
    | 'auth-missing'
    | 'rate-limited'
    | 'network'

export type GscQueryDecisionReason
  = | 'idle'
    | 'ssr'
    | 'disabled'
    | 'forced:server'
    | 'forced:browser'
    | 'optin:off'
    | 'auto:browser'
    | 'auto:fallback'

export interface GscQueryDecision {
  mode: 'browser' | 'server' | null
  reason: GscQueryDecisionReason
  detail?: string
}

export interface GscQueryMeta {
  raw: Record<string, unknown> | null
  retryAfter?: number
}

export interface UseGscQueryOptions<T> {
  site: MaybeRefOrGetter<string | null | undefined>
  params: MaybeRefOrGetter<AnalysisParams>
  /** The consumer-owned hosted operation. No legacy default endpoint exists. */
  serverFallback: (siteId: string, params: AnalysisParams) => Promise<T>
  engine?: GscQueryEngine
  /** Data sources. Equivalent projected values retain the current read. */
  watchSources?: WatchSource[]
  extractMeta?: (out: T) => Record<string, unknown> | null | undefined
  enabled?: MaybeRefOrGetter<boolean>
  /** Non-secret principal identity for callers outside the web session. */
  identityScope?: MaybeRefOrGetter<string>
}

export interface UseGscQueryReturn<T> {
  data: Ref<T | null>
  status: Ref<GscQueryStatus>
  pending: ComputedRef<boolean>
  error: Ref<Error | null>
  engine: Ref<'browser' | 'server' | null>
  elapsedMs: Ref<number | null>
  fallbackReason: Ref<string | null>
  lastDecision: Ref<GscQueryDecision>
  meta: Ref<GscQueryMeta>
  backfill: null
  refresh: () => Promise<void>
}

function isEmpty(value: unknown): boolean {
  if (value == null)
    return true
  if (Array.isArray(value))
    return value.length === 0
  if (typeof value !== 'object')
    return false
  const record = value as Record<string, unknown>
  return ['rows', 'results', 'daily', 'items'].some(key => Array.isArray(record[key]) && record[key].length === 0)
}

function errorStatus(error: unknown): GscQueryStatus {
  return classifyGscError(error).status
}

function stringifyWatchSources(values: unknown[]): string {
  const records = new WeakMap<object, Array<[string, unknown]>>()
  const maps = new WeakMap<object, Array<[unknown, unknown]>>()
  const sets = new WeakMap<object, unknown[]>()
  const ancestors = new Map<object, unknown>()
  function project(value: unknown, key: string): unknown {
    // JSON calls toJSON once per edge, with that edge's property or index.
    const toJSON = value !== null && value !== undefined && (typeof value === 'object' || typeof value === 'function' || typeof value === 'bigint')
      ? (value as { toJSON?: (key: string) => unknown }).toJSON
      : undefined
    const data = typeof toJSON === 'function' ? toJSON.call(value, key) : value
    if (typeof data === 'function' || typeof data === 'symbol')
      return undefined
    if (!data || typeof data !== 'object')
      return data
    const tag = defaultStringifyOperations.tagOf(data)
    if (tag === 'Number' || tag === 'String' || tag === 'Boolean')
      return project(defaultStringifyOperations.unbox(data), key)
    if (ancestors.has(data))
      return ancestors.get(data)
    const result = Array.isArray(data) ? [] : {}
    ancestors.set(data, result)
    if (Array.isArray(data)) {
      const length = data.length
      for (let index = 0; index < length; index++)
        (result as unknown[])[index] = project(data[index], String(index)) ?? null
    }
    else if (data instanceof Map) {
      const entries: Array<[unknown, unknown]> = []
      maps.set(result, entries)
      for (const [key, item] of data)
        entries.push([project(key, ''), project(item, '')])
    }
    else if (data instanceof Set) {
      const members: unknown[] = []
      sets.set(result, members)
      for (const item of data)
        members.push(project(item, ''))
    }
    else {
      const entries: Array<[string, unknown]> = []
      records.set(result, entries)
      for (const key of Object.keys(data).sort()) {
        const item = project(defaultStringifyOperations.get(data, key), key)
        if (item !== undefined)
          entries.push([key, item])
      }
    }
    // Repeated acyclic data clones by value. Only ancestors retain backlinks.
    ancestors.delete(data)
    return result
  }
  return stringify(project(values, ''), {
    Record: value => records.get(value),
    MapEntries: value => maps.get(value),
    SetMembers: value => sets.get(value),
  })
}

/**
 * Consumer-owned query lifecycle for the v1 cutover.
 *
 * Browser DuckDB dispatch belonged to the retired `@gscdump/nuxt-analytics`
 * layer. Request Indexing now executes only its explicit hosted operation, so
 * there is no hidden legacy endpoint or nested pre-v1 package graph.
 */
export function useGscQuery<T>(options: UseGscQueryOptions<T>): UseGscQueryReturn<T> {
  const suppliedIdentity = options.identityScope
  const identity = suppliedIdentity === undefined
    ? useGscQueryIdentity()
    : computed(() => ({ _tag: 'Available' as const, scope: toValue(suppliedIdentity) }))
  const data = shallowRef<T | null>(null)
  const status = ref<GscQueryStatus>('idle')
  const error = ref<Error | null>(null)
  const engine = ref<'browser' | 'server' | null>(null)
  const elapsedMs = ref<number | null>(null)
  const fallbackReason = ref<string | null>(null)
  const lastDecision = ref<GscQueryDecision>({ mode: null, reason: 'idle' })
  const meta = ref<GscQueryMeta>({ raw: null })
  const pending = computed(() => status.value === 'pending')
  let generation = 0
  let disposed = false
  let dataScope: string | undefined
  const paramsKey = computed(() => JSON.stringify(toValue(options.params), (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value))
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
    return value
  }))
  // Parent renders can rebuild the same request object. Watch its values so
  // equal wire inputs retain their pending read and the rows it already answered.
  const requestKey = computed(() => JSON.stringify([
    identity.value.scope,
    toValue(options.site),
    paramsKey.value,
    stringifyWatchSources((options.watchSources ?? []).map(source => toValue(source))),
    options.enabled === undefined || toValue(options.enabled),
  ]))

  function captureMeta(output: T): void {
    const raw = options.extractMeta?.(output)
      ?? (output as { meta?: Record<string, unknown> } | null)?.meta
      ?? null
    meta.value = { raw }
  }

  async function runQuery(): Promise<void> {
    if (disposed)
      return
    const currentGeneration = ++generation
    const key = requestKey.value
    const ownsRequest = () => !disposed && currentGeneration === generation && requestKey.value === key
    if (import.meta.server) {
      status.value = 'idle'
      lastDecision.value = { mode: null, reason: 'ssr' }
      return
    }
    const scope = JSON.stringify([identity.value.scope, toValue(options.site), paramsKey.value])
    if (scope !== dataScope) {
      dataScope = scope
      data.value = null
      error.value = null
      engine.value = null
      elapsedMs.value = null
      meta.value = { raw: null }
    }
    if (options.enabled !== undefined && !toValue(options.enabled)) {
      data.value = null
      error.value = null
      engine.value = null
      elapsedMs.value = null
      status.value = 'idle'
      lastDecision.value = { mode: null, reason: 'disabled' }
      return
    }
    const siteId = toValue(options.site)
    if (!siteId) {
      status.value = 'idle'
      lastDecision.value = { mode: null, reason: 'idle' }
      return
    }
    if (identity.value._tag === 'Unavailable') {
      data.value = null
      status.value = 'auth-missing'
      lastDecision.value = { mode: null, reason: 'disabled' }
      return
    }

    status.value = 'pending'
    error.value = null
    fallbackReason.value = null
    lastDecision.value = { mode: 'server', reason: 'forced:server' }
    const startedAt = performance.now()
    try {
      const output = await options.serverFallback(siteId, toValue(options.params))
      if (!ownsRequest())
        return
      data.value = output
      engine.value = 'server'
      elapsedMs.value = performance.now() - startedAt
      captureMeta(output)
      status.value = isEmpty(output) ? 'empty' : 'success'
    }
    catch (cause) {
      if (!ownsRequest())
        return
      error.value = cause instanceof Error ? cause : new Error(String(cause))
      engine.value = 'server'
      elapsedMs.value = performance.now() - startedAt
      const failureStatus = errorStatus(cause)
      if (failureStatus === 'auth-missing') {
        data.value = null
        meta.value = { raw: null }
      }
      status.value = failureStatus
    }
  }

  watch(requestKey, runQuery, { immediate: true })
  onScopeDispose(() => {
    disposed = true
    generation++
  })

  return {
    data,
    status,
    pending,
    error,
    engine,
    elapsedMs,
    fallbackReason,
    lastDecision,
    meta,
    backfill: null,
    refresh: runQuery,
  }
}
