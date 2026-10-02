import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { formatGuideDate } from './guide-date'

const runtimeZone = process.env.TZ

afterEach(() => {
  if (runtimeZone === undefined)
    delete process.env.TZ
  else
    process.env.TZ = runtimeZone
})

describe('formatGuideDate', () => {
  // The Worker renders in UTC; a reader's browser can run in any zone.
  it.each(['UTC', 'America/Los_Angeles', 'Pacific/Auckland'])('renders the frontmatter day when the runtime zone is %s', (zone) => {
    process.env.TZ = zone
    expect(formatGuideDate('2026-03-04')).toBe('Mar 4, 2026')
    expect(formatGuideDate('2026-10-01')).toBe('Oct 1, 2026')
  })

  it.each([undefined, '', 'not a date'])('renders nothing for %j', (day) => {
    expect(formatGuideDate(day)).toBe('')
  })
})
