import process from 'node:process'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { formatGuideDate } from './guide-date'

// Runs before the import above. The module then loads west of UTC, so a
// formatter built at import time without a fixed zone fails on any host.
const hostZone = vi.hoisted(() => {
  const zone = globalThis.process.env.TZ
  globalThis.process.env.TZ = 'America/Los_Angeles'
  return zone
})
const loadZone = process.env.TZ

function setZone(zone: string | undefined) {
  if (zone === undefined)
    delete process.env.TZ
  else
    process.env.TZ = zone
}

afterEach(() => setZone(loadZone))
afterAll(() => setZone(hostZone))

describe('formatGuideDate', () => {
  // The server renders in UTC; a reader's browser can run in any zone.
  it.each(['UTC', 'America/Los_Angeles', 'Pacific/Auckland'])('renders the frontmatter day when the runtime zone is %s', (zone) => {
    process.env.TZ = zone
    expect(formatGuideDate('2026-03-04')).toBe('Mar 4, 2026')
    expect(formatGuideDate('2026-10-01')).toBe('Oct 1, 2026')
  })

  it.each([undefined, '', 'not a date'])('renders nothing for %j', (day) => {
    expect(formatGuideDate(day)).toBe('')
  })
})
