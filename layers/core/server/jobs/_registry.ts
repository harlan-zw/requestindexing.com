import type { TaskName } from '#shared/types/tasks'
import type { JobDefinition, JobHandler, QueueName } from './_types'

// Import all job handlers
import sitesSetup from './sites/setup'
import sitesSyncFinished from './sites/sync-finished'
import teamsSyncSelected from './teams/sync-selected'

type RegisteredJob = { [K in TaskName]: JobDefinition<K> }[TaskName]

export const jobs: RegisteredJob[] = [
  // Sites
  sitesSetup,
  sitesSyncFinished,

  // Teams
  teamsSyncSelected,
]

// Lookup map for fast dispatch
export const handlers = new Map<TaskName, RegisteredJob>(jobs.map(job => [job.name, job]))

export function getHandler<T extends TaskName>(name: T): JobHandler<T> | undefined {
  return handlers.get(name)?.handle as JobHandler<T> | undefined
}

export function getJobDefinition<T extends TaskName>(name: T): JobDefinition<T> | undefined {
  return jobs.find(j => j.name === name) as JobDefinition<T> | undefined
}

export function getJobQueue(name: TaskName): QueueName | undefined {
  return jobs.find(j => j.name === name)?.queue
}

export function validateRegistry(expectedTasks: TaskName[]): { missing: TaskName[], extra: TaskName[] } {
  const registered = new Set(handlers.keys())
  const expected = new Set(expectedTasks)
  const missing = expectedTasks.filter(t => !registered.has(t))
  const extra = [...registered].filter(t => !expected.has(t as TaskName)) as TaskName[]
  return { missing, extra }
}
