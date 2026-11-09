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
it('exports actual campaign fields and capture time independently of signup time', () => {
  const now = Date.parse('2026-11-09T12:00:00Z')
  const users = buildObservedFunnelUsers([{ id: 1, name: 'Example', email: 'operator@example.test', createdAt: '2026-11-01', completedAt: null, source: null, teamId: 1, engineUserId: null }], [{ userId: 1, type: 'signed_up', createdAt: '2026-11-01T00:00:00Z', payload: { attributionBasis: 'journey_linked', attributionSource: 'utm:docs', utmSource: 'docs', utmMedium: 'email', utmCampaign: 'november', utmContent: 'header', utmTerm: 'indexing', referrerDomain: 'search.example', landingPath: '/tools', capturedAt: '2026-10-31T23:59:00Z', provider: 'google', channelClass: 'owned' } }], [], now)
  const csv = exportFunnelCsv(users, parseFunnelQuery({ from: '2026-11-01', to: '2026-11-09' }), now)
  expect(csv).toContain('"utm_source","utm_medium","utm_campaign","utm_content","utm_term","referrer_domain","landing_group","attribution_captured_at_utc"')
  expect(csv).toContain('"docs","email","november","header","indexing","search.example","/tools","2026-10-31T23:59:00.000Z","google","owned"')
  expect(csv).toContain('"2026-11-01T00:00:00.000Z"')
})
