import { issueDetails } from '@gscdump/sdk/indexing-issues'
import { describe, expect, it } from 'vitest'
import {
  buildSiteIndexingIssueRoute,
  describeEmptyIndexingBreakdown,
  getSiteIndexingIssues,
} from './site-indexing-issues'

const EVERY_ISSUE = {
  issues: { serverError: 1, notFound: 2, soft404: 3, blockedByRobots: 4 },
  coverage: { crawledNotIndexed: 5, discoveredNotCrawled: 6 },
  signals: { richResultsFail: 7 },
}

describe('getSiteIndexingIssues', () => {
  it('lists failures before attention rows, larger counts first', () => {
    const labels = getSiteIndexingIssues(EVERY_ISSUE).map(issue => `${issue.label}:${issue.count}`)
    expect(labels).toEqual([
      'Crawled, not indexed:5',
      'Soft 404:3',
      'Not found:2',
      'Server error:1',
      'Rich result errors:7',
      'Discovered, not crawled:6',
      'Blocked by robots.txt:4',
    ])
  })

  it('drops zero counts', () => {
    expect(getSiteIndexingIssues({ issues: { notFound: 0 }, coverage: { crawledNotIndexed: 2 } }).map(issue => issue.id))
      .toEqual(['crawled-not-indexed'])
    expect(getSiteIndexingIssues(null)).toEqual([])
  })
})

describe('buildSiteIndexingIssueRoute', () => {
  // The URLs page drops an `issue` value gscdump does not define, so a link
  // with a stale key lands on the unfiltered list with no signal.
  it('links every issue to a filter the URLs page accepts', () => {
    for (const issue of getSiteIndexingIssues(EVERY_ISSUE)) {
      const url = new URL(buildSiteIndexingIssueRoute('s_abc', issue), 'https://example.com')
      expect(url.pathname).toBe('/pro/dashboard/sites/s_abc/indexing/urls')
      const value = url.searchParams.get('issue')
      if (value)
        expect(issueDetails).toHaveProperty(value)
      else
        expect(url.searchParams.get('facet')).toBe('rich_results')
    }
  })
})

describe('describeEmptyIndexingBreakdown', () => {
  it('tells a fully indexed Site apart from one with unexplained gaps', () => {
    expect(describeEmptyIndexingBreakdown({}, { indexed: 10, totalUrls: 10 }))
      .toBe('Every inspected URL is indexed, so there is nothing to break down.')
    expect(describeEmptyIndexingBreakdown({}, { indexed: 9, totalUrls: 10 }))
      .toBe('Google has not attributed a reason to the 1 URL it has not indexed.')
  })

  it('says when Search Console has not reported yet', () => {
    expect(describeEmptyIndexingBreakdown(null, { indexed: 0, totalUrls: 0 }))
      .toContain('has not reported coverage')
  })
})
