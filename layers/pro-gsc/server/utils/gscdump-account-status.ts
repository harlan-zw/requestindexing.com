import type { AccountStatus } from '@gscdump/contracts'
import type { H3Event } from 'h3'
import type { CachedAccountStatus } from '../../shared/gscdump-account-status'
import { logger } from '~~/shared/server/logger'
import { lookupCachedAccountStatus } from '../../shared/gscdump-account-status'
import { RENDER_PATH_TIMEOUT_MS, useGscdumpClient } from './gscdump-client'

const CACHE_READ_BUDGET_MS = 250

type CacheOperation = { _tag: 'Done' | 'Retired' } | { _tag: 'Failed', cause: unknown }
type CacheWrite = { _tag: 'Optional', revision: symbol } | { _tag: 'Authoritative' }
type AccountStatusRead
  = | { _tag: 'Computing', revision: symbol, promise: Promise<AccountStatus | null> }
    | { _tag: 'Persisting', revision: symbol, promise: Promise<AccountStatus | null>, entry: CachedAccountStatus }
interface AccountCacheOwner {
  revision: symbol
  readers: number
  mutation: symbol | null
  reading: AccountStatusRead | null
  persisting: Promise<CacheOperation> | null
}

// Coordinate only active reads and writes in this isolate. KV retains its
// existing cross-isolate consistency. Results remain only while their write
// is pending, within the original freshness. No expiry timer is scheduled.
const owners = new Map<string, AccountCacheOwner>()

function cacheKey(gscdumpUserId: string): string {
  return `gscdump-account-status:${gscdumpUserId}`
}

function retain(key: string) {
  let owner = owners.get(key)
  if (!owner) {
    owner = { revision: Symbol('account-status-owner'), readers: 0, mutation: null, reading: null, persisting: null }
    owners.set(key, owner)
  }
  owner.readers++
  return owner
}

function evict(key: string, owner: AccountCacheOwner) {
  if (!owner.readers && !owner.persisting && owners.get(key) === owner)
    owners.delete(key)
}

function release(key: string, owner: AccountCacheOwner) {
  owner.readers--
  evict(key, owner)
}

function enqueue(key: string, owner: AccountCacheOwner, write: CacheWrite, operation: () => Promise<unknown>): Promise<CacheOperation> {
  const previous = owner.persisting
  const task = Promise.resolve(previous).then((): Promise<CacheOperation> | CacheOperation => {
    if (write._tag === 'Optional' && owner.revision !== write.revision)
      return { _tag: 'Retired' }
    return Promise.resolve().then(operation).then(
      (): CacheOperation => ({ _tag: 'Done' }),
      (cause: unknown): CacheOperation => ({ _tag: 'Failed', cause }),
    )
  })
  owner.persisting = task
  void task.then(() => {
    if (owner.persisting === task)
      owner.persisting = null
    evict(key, owner)
  })
  return task
}

async function mutate(gscdumpUserId: string, operation: (key: string) => Promise<unknown>): Promise<void> {
  const key = cacheKey(gscdumpUserId)
  const owner = retain(key)
  const revision = Symbol('account-status-mutation')
  // Retire readers before waiting for a detached write. Confirmation happens
  // only after that write and this mutation have completed in order.
  owner.revision = revision
  owner.mutation = revision
  try {
    const result = await enqueue(key, owner, { _tag: 'Authoritative' }, () => operation(key))
    if (result._tag === 'Failed')
      throw result.cause
  }
  finally {
    if (owner.revision === revision) {
      // Reads started while the mutation was pending must retire too.
      owner.revision = Symbol('account-status-owner')
      owner.mutation = null
    }
    release(key, owner)
  }
}

/** Record an authoritative lifecycle read without an older write replacing it. */
export async function rememberGscdumpAccountStatus(gscdumpUserId: string, status: AccountStatus): Promise<void> {
  const storage = useStorage('cache')
  const entry: CachedAccountStatus = { _tag: 'Read', status, readAt: Date.now() }
  await mutate(gscdumpUserId, key => storage.setItem(key, entry))
}

/** Confirm invalidation after older same-isolate writes have finished. */
export async function forgetGscdumpAccountStatus(gscdumpUserId: string): Promise<void> {
  const storage = useStorage('cache')
  await mutate(gscdumpUserId, key => storage.removeItem(key))
}

async function readCache(key: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const missed = { _tag: 'Miss' } as const
  const deadline = new Promise<typeof missed>((resolve) => {
    timer = setTimeout(() => {
      logger.error('[gscdump account status] optional cache read exceeded 250 ms')
      resolve(missed)
    }, CACHE_READ_BUDGET_MS)
  })
  const read = Promise.resolve().then(() => useStorage('cache').getItem(key)).then(
    value => lookupCachedAccountStatus(value, Date.now()),
    (cause: unknown) => {
      logger.error('[gscdump account status] optional cache read unavailable:', cause)
      return missed
    },
  )
  return Promise.race([read, deadline]).finally(() => clearTimeout(timer))
}

async function readStatus(event: H3Event, gscdumpUserId: string, key: string, owner: AccountCacheOwner, revision: symbol, cacheMode: 'read' | 'skip'): Promise<AccountStatus | null> {
  const cached = owner.mutation || cacheMode === 'skip' ? { _tag: 'Miss' as const } : await readCache(key)
  if (owner.revision !== revision)
    return null
  if (cached._tag === 'Hit')
    return cached.status

  const status = await useGscdumpClient({ timeoutMs: RENDER_PATH_TIMEOUT_MS }).getUserLifecycle(gscdumpUserId).then(lifecycle => lifecycle.account.status).catch((error: unknown) => {
    logger.error('[gscdump account status] lifecycle read failed, status unknown for:', gscdumpUserId, error)
    return null
  })
  if (owner.revision !== revision)
    return null

  const entry: CachedAccountStatus = status ? { _tag: 'Read', status, readAt: Date.now() } : { _tag: 'Failed', readAt: Date.now() }
  const active = owner.reading
  const retained: AccountStatusRead | null = active?._tag === 'Computing' && active.revision === revision
    ? { _tag: 'Persisting', revision, promise: active.promise, entry }
    : null
  if (retained)
    owner.reading = retained
  const writing = enqueue(key, owner, { _tag: 'Optional', revision }, () => useStorage('cache').setItem(key, entry)).then((result) => {
    if (result._tag === 'Failed')
      logger.error('[gscdump account status] optional cache write unavailable:', result.cause)
  }).finally(() => {
    if (owner.reading === retained)
      owner.reading = null
    evict(key, owner)
  })
  event.waitUntil(writing)
  return status
}

/**
 * Read optional account status without holding HTML for cache transport.
 * Current lifecycle reads keep their existing 2500 ms deadline. Valid status
 * freshness and failed-read freshness remain ten minutes and sixty seconds.
 */
export function readGscdumpAccountStatus(gscdumpUserId: string, event: H3Event): Promise<AccountStatus | null> {
  const key = cacheKey(gscdumpUserId)
  const owner = retain(key)
  const active = owner.reading
  let cacheMode: 'read' | 'skip' = 'read'
  if (active?.revision === owner.revision) {
    if (active._tag === 'Computing') {
      release(key, owner)
      return active.promise
    }
    const current = lookupCachedAccountStatus(active.entry, Date.now())
    if (current._tag === 'Hit') {
      release(key, owner)
      return Promise.resolve(current.status)
    }
    // An expired pending write cannot make the older KV answer current.
    owner.reading = null
    cacheMode = 'skip'
  }
  const revision = owner.revision
  const promise = readStatus(event, gscdumpUserId, key, owner, revision, cacheMode).finally(() => {
    if (owner.reading?._tag === 'Computing' && owner.reading.promise === promise)
      owner.reading = null
    release(key, owner)
  })
  owner.reading = { _tag: 'Computing', revision, promise }
  return promise
}
