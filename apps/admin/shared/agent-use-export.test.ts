import { expect, it } from 'vitest'
import { exportAgentUseCsv } from './agent-use-export'

it('exports configuration counts separately from successful use and preserves the source note', () => {
  const output = exportAgentUseCsv({ _tag: 'Available', measuredAt: '2026-11-10T00:00:00.000Z', localJourney: { _tag: 'Unavailable', signedUpAt: '2026-11-01T00:00:00.000Z', reason: 'success_time' }, activities: [{ surface: 'cli', client: 'gscdump-cli', label: 'CLI', configuredUsers: 1, successfulUsers: null, successfulCalls: null, firstObservedAt: null, lastObservedAt: null, coverage: 'unavailable', note: 'Configuration only.' }] }, 'u_engine')
  const cells = output.split('\r\n').map(row => [...row.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(match => match[1]!.replace(/^"|"$/g, '').replaceAll('""', '"')))
  const row = Object.fromEntries(cells[0]!.map((name, index) => [name, cells[1]![index]]))
  expect(row).toMatchObject({ configured_users: '1', successful_users: '', successful_calls: '', coverage: 'unavailable', note: 'Configuration only.', measured_at_utc: '2026-11-10T00:00:00.000Z' })
})

it('keeps skill context and formula-like reported clients safe in the export', () => {
  const output = exportAgentUseCsv({ _tag: 'Available', measuredAt: '2026-11-10T00:00:00.000Z', localJourney: { _tag: 'Unavailable', signedUpAt: '2026-11-01T00:00:00.000Z', reason: 'success_time' }, activities: [], skills: [{ surface: 'cli', client: '=client', name: 'gscdump', version: '7.14.0', successfulUsers: 1, successfulCalls: 2, firstObservedAt: '2026-11-02T00:00:00.000Z', lastObservedAt: '2026-11-03T00:00:00.000Z', note: 'Reported context.' }], skillsTruncated: true }, 'u_engine')
  expect(output).toContain('"\'=client"')
  expect(output).toContain('"gscdump","7.14.0","","1","2"')
  expect(output).toContain('"retained","true"')
  expect(output).not.toContain('"configured"')
})
