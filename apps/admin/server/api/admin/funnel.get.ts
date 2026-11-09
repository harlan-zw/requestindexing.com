import { setHeader } from 'h3'
import { buildFunnelReport, parseFunnelQuery } from '../../../shared/funnel'
import { exportFunnelCsv } from '../../../shared/funnel-export'
import { ADMIN_JOURNEY_COPY } from '../../../shared/journey-evidence'
import { requireAdminAuth } from '../../utils/admin'
import { readFunnelUsers } from '../../utils/funnel-data'

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event)
  const raw = getQuery(event)
  let query
  try {
    query = parseFunnelQuery(raw)
  }
  catch (error) {
    throw createError({ statusCode: 400, message: (error as Error).message })
  }
  if (raw.format !== undefined && raw.format !== 'csv')
    throw createError({ statusCode: 400, message: ADMIN_JOURNEY_COPY.invalidExport })
  const now = Date.now()
  const users = await readFunnelUsers(event, now)
  setHeader(event, 'Cache-Control', 'private, no-store')
  if (raw.format === 'csv') {
    setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'attachment; filename="signup-funnel.csv"')
    return exportFunnelCsv(users, query, now)
  }
  return buildFunnelReport(users, query, now)
})
