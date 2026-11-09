import { expect, it } from 'vitest'
import { parseFunnelQuery } from './funnel'
import { csvCell, exportFunnelCsv } from './funnel-export'
import { buildObservedFunnelUsers } from './funnel-observations'

it.each(['=SUM(1,1)', ' \t+cmd', '\r\n@SUM(1)', '\u0000-1', '\uFEFF=1'])('guards spreadsheet formulas in supplied text %j', (text) => {
  expect(csvCell(text)).toBe(`"'${text.replaceAll('"', '""')}"`)
})
it('preserves filtered full cohorts across pages, UTC timestamps and null coverage', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const users = buildObservedFunnelUsers(Array.from({ length: 121 }, (_, index) => ({ id: index + 1, name: `User ${index + 1}`, email: `${index}@example.test`, createdAt: '2026-11-01T00:00:00.000Z', completedAt: null, source: 'legacy', teamId: index, engineUserId: null })), [], [], now)
  const query = parseFunnelQuery({ from: '2026-11-01', to: '2026-11-10', source: 'legacy' }, now)
  const csv = exportFunnelCsv(users, query, now)
  expect(csv.split('\r\n')).toHaveLength(122)
  expect(csv).toContain('2026-11-01T00:00:00.000Z')
  expect(csv).toContain('"Missing"')
  expect(csv).toContain('"unavailable"')
  expect(exportFunnelCsv(users, { ...query, source: 'other' }, now).split('\r\n')).toHaveLength(1)
})
