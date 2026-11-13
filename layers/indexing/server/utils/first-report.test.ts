import { describe, expect, it, vi } from 'vitest'
import { firstReportPlanMatches, readFirstReportCandidates, signFirstReportPlan, verifyFirstReportPlan } from './first-report'

describe('first report boundary', () => {
  it('pins later pages and selects ten exact-host URLs inside the property prefix', async () => {
    const read = vi.fn().mockResolvedValueOnce({ generation: { id: 'g1', observedAt: 1000 }, items: [{ url: 'https://www.example.com/docs/a' }, { url: 'https://example.com/other' }], page: { nextCursor: 'p2' } }).mockResolvedValueOnce({ generation: { id: 'g1', observedAt: 1000 }, items: [...Array.from({ length: 12 }, (_, i) => ({ url: `https://example.com/docs/${i}` })), { url: 'https://example.com/docs/0' }], page: { nextCursor: null } })
    const result = await readFirstReportCandidates('example.com', 'https://example.com/docs/', read)
    expect(result).toMatchObject({ _tag: 'Ready', generationId: 'g1', urls: Array.from({ length: 10 }, (_, i) => `https://example.com/docs/${i}`) })
    expect(read.mock.calls[1]?.[0]).toEqual({ cursor: 'p2', generationId: 'g1', limit: 100 })
  })

  it('does not turn an incomplete bounded search into an empty Site', async () => {
    const read = vi.fn().mockResolvedValue({ generation: { id: 'g1', observedAt: 1000 }, items: [], page: { nextCursor: 'more' } })
    expect(await readFirstReportCandidates('example.com', 'https://example.com/docs/', read)).toEqual({ _tag: 'Incomplete' })
  })

  it('normalizes duplicates and rejects even empty URL fragments before quota use', async () => {
    const read = async () => ({ generation: { id: 'g1', observedAt: 1000 }, items: [{ url: 'https://EXAMPLE.com:443/docs/a' }, { url: 'https://example.com/docs/a' }, { url: 'https://example.com/docs/b#' }, { url: 'https://name@example.com/docs/c' }], page: { nextCursor: null } })
    expect(await readFirstReportCandidates('example.com', 'https://example.com/docs/', read)).toMatchObject({ urls: ['https://example.com/docs/a'] })
  })

  it('rejects tampering and expired authorization without exposing the signing secret', async () => {
    const plan = { userId: 1, teamId: 2, siteId: 'local', remoteSiteId: 'remote', property: 'https://example.com/', generationId: 'g1', urls: ['https://example.com/'], expiresAt: 2000 }
    const token = await signFirstReportPlan(plan, 'a'.repeat(40))
    expect(await verifyFirstReportPlan(token, 'a'.repeat(40), 1000)).toEqual(plan)
    expect(await verifyFirstReportPlan(`${token.slice(0, -4)}AAAA`, 'a'.repeat(40), 1000)).toBeNull()
    expect(await verifyFirstReportPlan(token, 'a'.repeat(40), 2000)).toBeNull()
    expect(firstReportPlanMatches(plan, { ...plan, teamId: 3 })).toBe(false)
    expect(firstReportPlanMatches(plan, { ...plan, property: 'https://example.com/changed/' })).toBe(false)
    expect(firstReportPlanMatches(plan, { ...plan, userId: 9 })).toBe(false)
  })
})
