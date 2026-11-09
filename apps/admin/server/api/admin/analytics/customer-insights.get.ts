import { setHeader } from 'h3'
import { buildCustomerInsights, parseCustomerInsightsQuery } from '../../../../shared/customer-insights'
import { ADMIN_JOURNEY_COPY } from '../../../../shared/journey-evidence'
import { requireAdminAuth } from '../../../utils/admin'
import { readFunnelUsers } from '../../../utils/funnel-data'

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  const query = parseCustomerInsightsQuery(getQuery(event))
  if (!query.success)
    throw createError({ statusCode: 400, message: ADMIN_JOURNEY_COPY.invalidFilters })
  const now = Date.now()
  const users = await readFunnelUsers(event, now)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return buildCustomerInsights(users, query.data, now)
})
