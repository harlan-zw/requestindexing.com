import type { AdminCtx } from '#layers/pro-saas/server/admin/admin-shell'
import { loadAdminRegistry, parseAdminListQuery } from '#layers/pro-saas/server/admin/registry'

// Lists one resource that a layer registered on the `admin:resources` hook,
// such as `pro-feedback`. The admin check runs before the registry loads or
// the database is read.
export default defineEventHandler(async (event) => {
  const session = await requireAdminAuth(event)
  const key = getRouterParam(event, 'key')
  const registry = await loadAdminRegistry(useNitroApp())
  const resource = key ? registry.getResource(key) : undefined
  if (!resource)
    throw createError({ statusCode: 404, message: `No admin resource named ${key}` })

  const query = parseAdminListQuery(getQuery(event), resource.perPage ?? 25)
  if (query._tag === 'Err')
    throw createError({ statusCode: 400, message: 'Choose a valid page, page size, search, or sort.', data: { issues: query.issues } })

  const ctx: AdminCtx = {
    event,
    db: useDrizzle(event) as unknown as AdminCtx['db'],
    // requireAdminAuth matched this email, so it is set.
    user: { id: String(session.user?.id), email: session.user?.email ?? '' },
  }
  if (resource.authorize && !(await resource.authorize(ctx)))
    throw createError({ statusCode: 403, message: 'Admin access required' })
  return resource.index(ctx, query.value)
})
