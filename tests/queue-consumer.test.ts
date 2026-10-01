import type { Job } from '../layers/core/server/utils/jobs'
import type { LogSink, LogSinkEntry } from '../shared/logging'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { onJobComplete, onJobFailed } from '../layers/core/server/utils/event-service'
import { dispatchJob } from '../layers/core/server/utils/job-dispatcher'
import { claimJob, completeJob, failJob, getCFQueue } from '../layers/core/server/utils/jobs'
import { addLogSink, removeLogSink } from '../shared/logging'

vi.mock('../layers/core/server/utils/jobs', () => ({
  claimJob: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  getCFQueue: vi.fn(),
}))

vi.mock('../layers/core/server/utils/event-service', () => ({
  onJobComplete: vi.fn(),
  onJobFailed: vi.fn(),
}))

vi.mock('../layers/core/server/utils/job-dispatcher', () => ({
  dispatchJob: vi.fn(),
}))

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const globals = globalThis as unknown as Record<PropertyKey, unknown>

interface FakeNitroApp {
  hooks: { hook: (name: string, handler: (payload: unknown) => Promise<void>) => void }
}

const callHook = vi.fn(async () => {})
const hookHandlers: Record<string, (payload: unknown) => Promise<void>> = {}

let db: unknown
let jobRow: unknown

function makeDb() {
  const run = async () => ({ meta: { changes: 1 } })
  const get = async () => jobRow
  return {
    run,
    select: () => ({ from: () => ({ where: () => ({ get }) }) }),
    update: () => ({ set: () => ({ where: () => ({ run }) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ run }), run }) }),
    delete: () => ({ where: () => ({ run }) }),
  }
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    queue: 'default',
    jobType: 'sync',
    batchId: null,
    userId: null,
    siteId: null,
    payload: { _task: 'sites/setup' },
    attempts: 3,
    maxAttempts: 3,
    reservedAt: null,
    availableAt: 0,
    createdAt: 0,
    completedAt: null,
    failedAt: null,
    lastError: null,
    durationMs: null,
    ...overrides,
  }
}

function makeMsg(jobId: string) {
  return { body: { jobId, queue: 'default' }, attempts: 1, ack: vi.fn(), retry: vi.fn() }
}

async function consume(queue: string, msg: ReturnType<typeof makeMsg>) {
  await hookHandlers['cloudflare:queue']!({
    batch: { queue, messages: [msg] },
    env: {},
  })
}

let sinkEntries: LogSinkEntry[]
let sink: LogSink

beforeAll(async () => {
  globals.defineNitroPlugin = (setup: (app: FakeNitroApp) => void) => setup
  globals.useNitroApp = () => ({ hooks: { callHook } })
  globals.useDrizzle = () => db

  const nitroApp: FakeNitroApp = {
    hooks: { hook: (name, handler) => { hookHandlers[name] = handler } },
  }

  const mod = await import('../layers/core/server/plugins/queue-consumer')
  ;(mod.default as unknown as (app: FakeNitroApp) => void)(nitroApp)
})

beforeEach(() => {
  vi.clearAllMocks()
  jobRow = null
  db = makeDb()

  vi.mocked(onJobComplete).mockResolvedValue({ batchComplete: false, onFinishQueued: false })
  vi.mocked(onJobFailed).mockResolvedValue({ batchComplete: false, onFinishQueued: false })
  vi.mocked(completeJob).mockResolvedValue({ durationMs: 5 })
  vi.mocked(failJob).mockResolvedValue(undefined)
  vi.mocked(getCFQueue).mockReturnValue(undefined)

  sinkEntries = []
  sink = entry => sinkEntries.push(entry)
  addLogSink(sink)
})

afterEach(() => {
  removeLogSink(sink)
})

describe('queue-consumer permanent-failure logging', () => {
  it('routes a job that exhausted its attempts through the catalogued error log', async () => {
    vi.mocked(claimJob).mockResolvedValueOnce(makeJob({ id: 'job-1', attempts: 3, maxAttempts: 3 }))
    vi.mocked(dispatchJob).mockRejectedValueOnce(new Error('boom'))
    const msg = makeMsg('job-1')

    await consume('ri-default', msg)

    const entry = sinkEntries.find(e => e.name === 'task.batch_item_failed')
    expect(entry).toBeDefined()
    expect(entry!.level).toBe('error')
    expect(entry!.error?.message).toBe('boom')
    expect(entry!.ctx).toMatchObject({ jobId: 'job-1', taskName: 'sites/setup', attempt: 3 })
    expect(msg.ack).toHaveBeenCalled()
  })

  it('routes a handler fail() through the catalogued error log', async () => {
    vi.mocked(claimJob).mockResolvedValueOnce(makeJob({ id: 'job-2', attempts: 1, maxAttempts: 3 }))
    vi.mocked(dispatchJob).mockResolvedValueOnce({
      success: true,
      control: { handled: true, action: 'failed', error: 'handler bailed' },
    })
    const msg = makeMsg('job-2')

    await consume('ri-default', msg)

    const entry = sinkEntries.find(e => e.name === 'task.batch_item_failed')
    expect(entry).toBeDefined()
    expect(entry!.level).toBe('error')
    expect(entry!.error?.message).toBe('handler bailed')
    expect(msg.ack).toHaveBeenCalled()
  })

  it('routes a DLQ-exhausted job through the catalogued error log', async () => {
    jobRow = makeJob({ id: 'job-9', lastError: '[DLQ 1] boom' })
    const msg = makeMsg('job-9')

    await consume('ri-dlq', msg)

    const entry = sinkEntries.find(e => e.name === 'task.batch_item_failed')
    expect(entry).toBeDefined()
    expect(entry!.level).toBe('error')
    expect(entry!.ctx).toMatchObject({ jobId: 'job-9' })
    expect(vi.mocked(failJob)).toHaveBeenCalledWith(db, 'job-9', expect.stringContaining('DLQ exhausted'))
    expect(msg.ack).toHaveBeenCalled()
  })

  it('keeps a retryable failure out of the catalogued error log', async () => {
    vi.mocked(claimJob).mockResolvedValueOnce(makeJob({ id: 'job-3', attempts: 1, maxAttempts: 3 }))
    vi.mocked(dispatchJob).mockRejectedValueOnce(new Error('boom'))
    const msg = makeMsg('job-3')

    await consume('ri-default', msg)

    expect(sinkEntries).toEqual([])
    expect(msg.retry).toHaveBeenCalled()
  })
})
