import { GOOGLE_COVERAGE_STATES } from 'gscdump'
import { describe, expect, it } from 'vitest'
import { diagnoseIndexing } from './indexing-diagnosis'

const NO_CRAWLED_SAMPLES = 'Need URL-level URL Inspection samples for the crawled-but-not-indexed bucket.'

/**
 * A Site whose crawled-not-indexed bucket is reported, with one sample row that
 * carries only Google's coverage prose and no issue type. The diagnosis must
 * decide from the prose alone whether that row is crawled-not-indexed evidence.
 */
function diagnoseWithProse(coverageState: string) {
  return diagnoseIndexing({
    totalUrls: 100,
    indexed: 10,
    issues: [{ type: 'crawled_not_indexed', label: 'Crawled - currently not indexed', count: 60 }],
    sampleUrls: [{ url: 'https://example.com/docs/a', issueType: null, coverageState }],
  })
}

const knownProse = Object.entries(GOOGLE_COVERAGE_STATES)
  .flatMap(([tag, states]) => states.map(state => [tag, state] as const))

describe('diagnoseIndexing with coverage prose and no issue type', () => {
  it.each(knownProse)('reads %s prose "%s" as crawled evidence only when Google says crawled, not indexed', (tag, prose) => {
    const diagnosis = diagnoseWithProse(prose)

    if (tag === 'crawled_not_indexed')
      expect(diagnosis.missingEvidence).not.toContain(NO_CRAWLED_SAMPLES)
    else
      expect(diagnosis.missingEvidence).toContain(NO_CRAWLED_SAMPLES)
  })

  it('reads prose with surrounding whitespace as crawled evidence', () => {
    const diagnosis = diagnoseWithProse('  Crawled - currently not indexed  ')

    expect(diagnosis.missingEvidence).not.toContain(NO_CRAWLED_SAMPLES)
  })
})
