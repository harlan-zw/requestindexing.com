import type { BatchItem } from 'drizzle-orm/batch'
import type { TaskMap, TaskName } from '#shared/types/tasks'
import type { QueueName } from '../jobs/_types'
import { eq, sql } from 'drizzle-orm'
import { failedJobs, jobBatches, jobs } from '../db/schema'
import { getJobQueue } from '../jobs/_registry'
import { getCFQueue } from './jobs'

// ============================================
// App Event Types
// ============================================

export interface EventContextMap {
  'app:site:created': { env: Record<string, unknown>, siteId: string, userId: number, permissionLevel?: string }
  'app:team:sites-selected': { env: Record<string, unknown>, teamId: number }
  'app:job:completed': { env: Record<string, unknown>, jobId: string, taskName: string, siteId?: string, userId?: number, durationMs: number }
  'app:job:failed': { env: Record<string, unknown>, jobId: string, taskName: string, error: string, attempt: number, permanent: boolean }
  'app:batch:progress': { env: Record<string, unknown>, batchId: string, batchName?: string, completed: number, total: number, failed: number }
  'app:batch:complete': { env: Record<string, unknown>, batchId: string, batchName?: string, total: number, failed: number }
}

export type AppEventName = keyof EventContextMap

export function emitAppEvent<E extends AppEventName>(
  event: E,
  ctx: EventContextMap[E],
): Promise<void> {
  const nitro = useNitroApp()
  return (nitro.hooks.callHook as (event: string, ctx: unknown) => Promise<void>)(event, ctx)
}

// ============================================
// Pure functions
// ============================================

export interface QueueConfig {
  queue: QueueName
  jobType: string
}

export function getQueueConfig(name: TaskName, _payload?: unknown): QueueConfig {
  const definedQueue = getJobQueue(name)
  return {
    queue: definedQueue ?? 'default',
    jobType: name.split('/')[0]!,
  }
}

export function buildJobPayload<T extends TaskName>(name: T, payload: TaskMap[T]): { _task: T } & TaskMap[T] {
  return { _task: name, ...payload }
}

// ============================================
// Batch options
// ============================================

export interface BatchOptions {
  name?: string
  siteId?: string
  userId?: number
  parentBatchId?: string
  delaySeconds?: number
  onFinish?: { name: TaskName, payload: TaskMap[TaskName] }
}

export interface JobDef<T extends TaskName = TaskName> {
  name: T
  payload: TaskMap[T]
  queue?: QueueName
}

// ============================================
// Queue dispatch
// ============================================

export async function dispatchToQueue(env: Record<string, unknown>, jobId: string, queue: QueueName, opts?: { delaySeconds?: number }): Promise<boolean> {
  const cfQueue = getCFQueue(env, queue)
  if (!cfQueue) {
    // Dev mode: process via direct handler invocation
    console.warn(`[Dispatch] No queue binding for ${queue}, processing job ${jobId} directly`)
    // Defer to avoid blocking the caller
    setTimeout(async () => {
      const { dispatchJob } = await import('./job-dispatcher')
      const { claimJob, completeJob } = await import('./jobs')
      const db = useDrizzle()
      const job = await claimJob(db, jobId)
      if (!job)
        return
      const result = await dispatchJob(env, job).catch((err) => {
        console.error(`[DevDispatch] Job ${jobId} failed:`, err)
        return { success: false as const, error: (err as Error).message, control: undefined }
      })
      if (result.success && !result.control?.handled) {
        await completeJob(db, jobId)
        const { onJobComplete } = await import('./event-service')
        await onJobComplete(db, env, jobId)
      }
    }, 0)
    return true
  }
  await cfQueue.send({ jobId, queue }, opts)
  return true
}

// ============================================
// High-level operations
// ============================================

export async function batchJobs(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  batchOptions: BatchOptions,
  jobDefs: JobDef[],
): Promise<{ batchId: string, jobIds: string[] }> {
  if (jobDefs.length === 0)
    return { batchId: '', jobIds: [] }

  const batchId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const jobIds: string[] = []
  const jobInserts: { id: string, queue: QueueName, jobType: string, payload: string }[] = []

  for (const jobDef of jobDefs) {
    const jobId = crypto.randomUUID()
    jobIds.push(jobId)

    const { queue, jobType } = getQueueConfig(jobDef.name, jobDef.payload)
    const effectiveQueue = jobDef.queue ?? queue
    const fullPayload = buildJobPayload(jobDef.name, jobDef.payload)
    jobInserts.push({ id: jobId, queue: effectiveQueue, jobType, payload: JSON.stringify(fullPayload) })
  }

  const D1_BATCH_LIMIT = 95
  const availableAt = now + (batchOptions.delaySeconds ?? 0)

  const batchRecord = db.insert(jobBatches).values({
    id: batchId,
    name: batchOptions.name,
    parentBatchId: batchOptions.parentBatchId,
    totalJobs: jobDefs.length,
    pendingJobs: jobDefs.length,
    failedJobs: 0,
    onFinish: batchOptions.onFinish ? JSON.stringify(batchOptions.onFinish) : undefined,
    siteId: batchOptions.siteId,
    userId: batchOptions.userId,
    createdAt: now,
    updatedAt: now,
  })

  const jobStatements = jobInserts.map(job =>
    db.insert(jobs).values({
      id: job.id,
      queue: job.queue,
      jobType: job.jobType,
      batchId,
      userId: batchOptions.userId ?? null,
      siteId: batchOptions.siteId ?? null,
      payload: job.payload,
      attempts: 0,
      maxAttempts: 3,
      availableAt,
      createdAt: now,
    }).onConflictDoNothing(),
  )

  // First batch: batch record + first chunk of jobs
  const firstChunkSize = D1_BATCH_LIMIT - (batchOptions.parentBatchId ? 2 : 1)
  const firstStatements: BatchItem<'sqlite'>[] = [batchRecord, ...jobStatements.slice(0, firstChunkSize)]

  if (batchOptions.parentBatchId) {
    firstStatements.push(
      db.update(jobBatches)
        .set({
          totalJobs: sql`total_jobs + 1`,
          pendingJobs: sql`pending_jobs + 1`,
          updatedAt: now,
        })
        .where(eq(jobBatches.id, batchOptions.parentBatchId)),
    )
  }

  await db.batch(firstStatements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])

  // Remaining chunks if needed
  for (let i = firstChunkSize; i < jobStatements.length; i += D1_BATCH_LIMIT) {
    const chunk = jobStatements.slice(i, i + D1_BATCH_LIMIT)
    if (chunk.length)
      await db.batch(chunk as unknown as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  }

  // Dispatch to queues in parallel
  const dispatchOpts = batchOptions.delaySeconds ? { delaySeconds: batchOptions.delaySeconds } : undefined
  await Promise.allSettled(
    jobInserts.map(job => dispatchToQueue(env, job.id, job.queue, dispatchOpts)),
  ).then((results) => {
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed.length > 0)
      console.error(`[Batch] ${failed.length}/${jobInserts.length} dispatch failures`)
  })

  return { batchId, jobIds }
}

export async function queueJob<T extends TaskName>(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  name: T,
  payload: TaskMap[T],
  opts?: { siteId?: string, userId?: number, batchId?: string },
): Promise<string> {
  const jobId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const { queue, jobType } = getQueueConfig(name, payload)
  const fullPayload = buildJobPayload(name, payload)

  if (opts?.batchId) {
    await db.run(sql`
      UPDATE job_batches
      SET total_jobs = total_jobs + 1,
          pending_jobs = pending_jobs + 1,
          updated_at = ${now}
      WHERE id = ${opts.batchId}
    `)
  }

  await db.insert(jobs).values({
    id: jobId,
    queue,
    jobType,
    batchId: opts?.batchId ?? null,
    userId: opts?.userId ?? null,
    siteId: opts?.siteId ?? null,
    payload: JSON.stringify(fullPayload),
    attempts: 0,
    maxAttempts: 3,
    availableAt: now,
    createdAt: now,
  }).onConflictDoNothing().run()

  await dispatchToQueue(env, jobId, queue)
    .catch(err => console.error(`[QueueJob] Dispatch failed for ${jobId} (${name}): ${err?.message || err}`))

  return jobId
}

export async function createParentBatch(
  db: ReturnType<typeof useDrizzle>,
  opts: {
    name: string
    siteId?: string
    userId?: number
    allowFailures?: boolean
    onFinish?: { name: TaskName, payload: TaskMap[TaskName] }
  },
): Promise<string> {
  const batchId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  await db.insert(jobBatches).values({
    id: batchId,
    name: opts.name,
    totalJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    allowFailures: opts.allowFailures ? 1 : 0,
    siteId: opts.siteId,
    userId: opts.userId,
    onFinish: opts.onFinish ? JSON.stringify(opts.onFinish) : undefined,
    createdAt: now,
    updatedAt: now,
  }).run()

  return batchId
}

// ============================================
// Batch completion handling
// ============================================

export interface BatchProgress {
  batchId: string
  name?: string
  completed: number
  total: number
  failed: number
}

export interface JobCompleteResult {
  batchComplete: boolean
  onFinishQueued: boolean
  batchProgress?: BatchProgress
}

export async function onJobComplete(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  jobId: string,
): Promise<JobCompleteResult> {
  return handleBatchDecrement(db, env, jobId, false)
}

export async function onJobFailed(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  jobId: string,
): Promise<JobCompleteResult> {
  return handleBatchDecrement(db, env, jobId, true)
}

async function handleBatchDecrement(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  jobId: string,
  isFailed: boolean,
): Promise<JobCompleteResult> {
  // Get batchId from jobs or failed_jobs
  const job = await db.select({ batchId: jobs.batchId }).from(jobs).where(eq(jobs.id, jobId)).get()
  let batchId = job?.batchId
  if (!batchId) {
    const failed = await db.select({ batchId: failedJobs.batchId }).from(failedJobs).where(eq(failedJobs.id, jobId)).get()
    batchId = failed?.batchId
  }

  if (!batchId)
    return { batchComplete: false, onFinishQueued: false }

  // Atomic decrement
  await db.run(sql`
    UPDATE job_batches
    SET pending_jobs = pending_jobs - 1,
        failed_jobs = failed_jobs + ${isFailed ? 1 : 0},
        updated_at = ${Math.floor(Date.now() / 1000)},
        finished_at = CASE WHEN pending_jobs = 1 AND finished_at IS NULL THEN ${Math.floor(Date.now() / 1000)} ELSE finished_at END
    WHERE id = ${batchId}
  `)

  const batch = await db.select().from(jobBatches).where(eq(jobBatches.id, batchId)).get()
  if (!batch)
    return { batchComplete: false, onFinishQueued: false }

  const batchProgress: BatchProgress = {
    batchId: batch.id,
    name: batch.name ?? undefined,
    completed: batch.totalJobs - batch.pendingJobs,
    total: batch.totalJobs,
    failed: batch.failedJobs,
  }

  if (batch.pendingJobs !== 0)
    return { batchComplete: false, onFinishQueued: false, batchProgress }

  // Queue onFinish callback
  let onFinishQueued = false
  if (batch.onFinish) {
    const callback = JSON.parse(batch.onFinish) as { name: TaskName, payload: TaskMap[TaskName] }
    const payload = { ...callback.payload, batchId: batch.id }
    await queueJob(db, env, callback.name, payload as TaskMap[TaskName], {
      siteId: batch.siteId ?? undefined,
      userId: batch.userId ?? undefined,
    })
    onFinishQueued = true
  }

  // Bubble up to parent
  if (batch.parentBatchId) {
    await onChildBatchComplete(db, env, batch.parentBatchId)
  }

  return { batchComplete: true, onFinishQueued, batchProgress }
}

async function onChildBatchComplete(
  db: ReturnType<typeof useDrizzle>,
  env: Record<string, unknown>,
  parentBatchId: string,
): Promise<void> {
  await db.run(sql`
    UPDATE job_batches
    SET pending_jobs = pending_jobs - 1,
        updated_at = ${Math.floor(Date.now() / 1000)},
        finished_at = CASE WHEN pending_jobs = 1 AND finished_at IS NULL THEN ${Math.floor(Date.now() / 1000)} ELSE finished_at END
    WHERE id = ${parentBatchId}
  `)

  const parent = await db.select().from(jobBatches).where(eq(jobBatches.id, parentBatchId)).get()
  if (!parent || parent.pendingJobs !== 0)
    return

  if (parent.onFinish) {
    const callback = JSON.parse(parent.onFinish) as { name: TaskName, payload: TaskMap[TaskName] }
    const payload = { ...callback.payload, batchId: parent.id }
    await queueJob(db, env, callback.name, payload as TaskMap[TaskName], {
      siteId: parent.siteId ?? undefined,
      userId: parent.userId ?? undefined,
    })
  }
}
