export interface TaskMap {
  'sites/setup': { siteId: string }
  'sites/sync-finished': { siteId: string }
  'teams/sync-selected': { teamId: number }
}

export type TaskName = keyof TaskMap
