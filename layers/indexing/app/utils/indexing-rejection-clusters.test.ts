import { describe, expect, it } from 'vitest'
import { clusterRejectedUrls } from './indexing-rejection-clusters'

function row(path: string, issueType = 'crawled_not_indexed') {
  return { url: `https://example.com${path}`, issueType }
}

describe('clusterRejectedUrls', () => {
  it('groups refused URLs by their first path segment, largest first', () => {
    const report = clusterRejectedUrls([
      row('/tag/vue'),
      row('/tag/nuxt'),
      row('/tag/seo'),
      row('/author/harlan', 'discovered_not_indexed'),
      row('/author/guest', 'soft_404'),
    ])

    expect(report.clusters.map(cluster => [cluster.pathPattern, cluster.count])).toEqual([
      ['/tag/*', 3],
      ['/author/*', 2],
    ])
    expect(report.rejectedTotal).toBe(5)
    expect(report.clusteredTotal).toBe(5)
  })

  it('counts a share against every refused URL, so the shares never exceed the total', () => {
    const report = clusterRejectedUrls([
      row('/tag/a'),
      row('/tag/b'),
      row('/one-off'),
    ])

    expect(report.clusters).toHaveLength(1)
    expect(report.clusters[0]!.share).toBeCloseTo(2 / 3)
    expect(report.rejectedTotal).toBe(3)
    expect(report.clusteredTotal).toBe(2)
  })

  it('ignores rows Google did not refuse', () => {
    const report = clusterRejectedUrls([
      row('/tag/a', 'noindex'),
      row('/tag/b', 'blocked_robots'),
      row('/tag/c'),
      { url: 'https://example.com/tag/d', issueType: null },
    ])

    expect(report.rejectedTotal).toBe(1)
    expect(report.clusters).toEqual([])
  })

  it('keeps a page at the root out of a made-up cluster', () => {
    const report = clusterRejectedUrls([row('/'), row('/')], { minClusterSize: 2 })

    expect(report.clusters.map(cluster => cluster.pathPattern)).toEqual(['/'])
  })

  it('drops an unparseable URL rather than counting it as refused', () => {
    const report = clusterRejectedUrls([
      { url: 'not a url', issueType: 'soft_404' },
      row('/tag/a'),
      row('/tag/b'),
    ])

    expect(report.rejectedTotal).toBe(2)
  })

  it('caps the returned clusters, keeping the largest', () => {
    const rows = ['a', 'b', 'c'].flatMap(segment => [row(`/${segment}/1`), row(`/${segment}/2`)])
    const report = clusterRejectedUrls([...rows, row('/big/1'), row('/big/2'), row('/big/3')], { limit: 2 })

    expect(report.clusters.map(cluster => cluster.pathPattern)).toEqual(['/big/*', '/a/*'])
  })

  it('keeps at most three sample URLs per cluster', () => {
    const report = clusterRejectedUrls([1, 2, 3, 4, 5].map(index => row(`/tag/${index}`)))

    expect(report.clusters[0]!.sampleUrls).toEqual([
      'https://example.com/tag/1',
      'https://example.com/tag/2',
      'https://example.com/tag/3',
    ])
  })
})
