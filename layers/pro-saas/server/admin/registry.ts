// The admin registry: what the `admin:resources` hook collects, and the one
// place that fires it. Ported from nuxtseo.com `layers/admin-host`
// (ADR-0040) without its API key, CORS, or SPA: here an admin signs in to
// this app, and `requireAdminAuth` gates every route that reads the registry.
//
// The hook fires once per Nitro app, on the first admin request, so resource
// modules cost nothing on a request that is not an admin one.

import type { NitroApp } from 'nitropack/types'
import type { AdminListQuery, AdminPanelDef, AdminRegistry, AdminResourceDef } from './admin-shell'

declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    'admin:resources': (registry: AdminRegistry) => void | Promise<void>
  }
}

export function createAdminRegistry(): AdminRegistry {
  const resources = new Map<string, AdminResourceDef>()
  const panels = new Map<string, AdminPanelDef>()
  return {
    addResource: resource => void resources.set(resource.key, resource),
    addPanel: panel => void panels.set(panel.key, panel),
    getResource: key => resources.get(key),
    getPanel: key => panels.get(key),
    list: () => ({ resources: [...resources.values()], panels: [...panels.values()] }),
  }
}

const loaded = new WeakMap<NitroApp, Promise<AdminRegistry>>()

/** The registry every `admin:resources` listener filled, built once per Nitro app. */
export function loadAdminRegistry(nitroApp: NitroApp): Promise<AdminRegistry> {
  const existing = loaded.get(nitroApp)
  if (existing)
    return existing
  const registry = createAdminRegistry()
  // hookable answers synchronously when every listener is synchronous, so the
  // result is wrapped before it is chained.
  const ready = Promise.resolve(nitroApp.hooks.callHook('admin:resources', registry)).then(() => registry)
  // A listener that throws must not pin a broken registry for the life of the
  // Worker. The request still fails; the next one fires the hook again.
  ready.catch(() => loaded.delete(nitroApp))
  loaded.set(nitroApp, ready)
  return ready
}

interface AdminListQueryIssue {
  field: 'search' | 'sort' | 'page' | 'perPage'
  message: string
}

export type ParseAdminListQueryResult
  = | { _tag: 'Ok', value: AdminListQuery }
    | { _tag: 'Err', issues: AdminListQueryIssue[] }

const MAX_PAGE_SIZE = 100

function parsePositiveInteger(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined)
    return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null
}

/**
 * Parse a list request's query once, at the route. Ported from nuxtseo.com
 * `admin-list-query.ts`, without `filters`: no resource here reads one.
 */
export function parseAdminListQuery(query: Record<string, unknown>, defaultPerPage: number): ParseAdminListQueryResult {
  const issues: AdminListQueryIssue[] = []
  const page = parsePositiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER)
  if (page === null)
    issues.push({ field: 'page', message: 'must be a positive integer' })
  const perPage = parsePositiveInteger(query.perPage, defaultPerPage, MAX_PAGE_SIZE)
  if (perPage === null)
    issues.push({ field: 'perPage', message: `must be an integer from 1 to ${MAX_PAGE_SIZE}` })

  if (query.search !== undefined && typeof query.search !== 'string')
    issues.push({ field: 'search', message: 'must be a string' })

  let sort: AdminListQuery['sort']
  if (query.sort !== undefined) {
    const match = typeof query.sort === 'string' ? /^([^:]+):(asc|desc)$/.exec(query.sort) : null
    if (match)
      sort = { key: match[1]!, dir: match[2] as 'asc' | 'desc' }
    else
      issues.push({ field: 'sort', message: 'must use key:asc or key:desc' })
  }

  if (issues.length > 0 || page === null || perPage === null)
    return { _tag: 'Err', issues }
  return {
    _tag: 'Ok',
    value: { search: typeof query.search === 'string' ? query.search : undefined, sort, page, perPage },
  }
}
