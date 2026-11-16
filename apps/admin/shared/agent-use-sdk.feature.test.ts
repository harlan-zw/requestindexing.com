import type { AgentActivityData } from './agent-use-export'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import { expect, it } from 'vitest'
import { buildAgentUseJourney } from './agent-use'
import { exportAgentUseCsv } from './agent-use-export'

it('retains reported skill evidence through the published SDK, journey and CSV', async () => {
  const activities = [{ surface: 'cli', client: 'gscdump-cli', label: 'CLI', configuredUsers: 1, successfulUsers: 1, successfulCalls: 3, firstObservedAt: '2026-11-11T00:00:00.000Z', lastObservedAt: '2026-11-14T00:00:00.000Z', coverage: 'retained', note: 'Credential-owned observations.' }]
  const skills = [{ surface: 'cli', client: 'gscdump-cli', name: 'gscdump', version: '7.14.0', successfulUsers: 1, successfulCalls: 3, firstObservedAt: '2026-11-11T00:00:00.000Z', lastObservedAt: '2026-11-14T00:00:00.000Z', note: 'Caller-reported context.' }]
  let sent: Headers | undefined
  const client = createGscdumpV1Client({ credential: 'fixture_partner', requestContext: { skillName: 'gscdump', skillVersion: '7.14.0' }, fetch: async (_url, init) => {
    sent = new Headers(init?.headers)
    return Response.json({ data: { measuredAt: '2026-11-16T00:00:00.000Z', activities, skills, skillsTruncated: true }, meta: { requestId: 'req_fixture', surface: 'partner', version: '1.0' } })
  } })

  const response = await client.getUserIntegrationActivity({ params: { userId: 'u_fixture' } })
  const data: AgentActivityData = response.data
  const result = { _tag: 'Available' as const, ...data, localJourney: buildAgentUseJourney('2026-11-10T00:00:00.000Z', data.measuredAt, data.activities) }
  const csv = exportAgentUseCsv(result, 'u_fixture')

  expect(data.skills).toEqual(skills)
  expect(sent?.get('authorization')).toBe('Bearer fixture_partner')
  expect(sent?.get('x-gscdump-skill-name')).toBe('gscdump')
  expect(sent?.get('x-gscdump-skill-version')).toBe('7.14.0')
  expect(data.skillsTruncated).toBe(true)
  expect(result.localJourney).toMatchObject({ _tag: 'Observed', returnedAt: '2026-11-14T00:00:00.000Z' })
  expect(csv).toContain('"u_fixture","reported_skill","cli","gscdump-cli","gscdump","7.14.0","","1","3"')
  expect(csv).toContain('"retained","true","Caller-reported context."')
})
