import type { IndexingUrlPage } from './indexing-url-pages'
import { describe, expect, it } from 'vitest'
import { INDEXING_URLS_PAGE_LIMIT, readIndexingUrlPages } from './indexing-url-pages'

interface Row { url: string }

interface PageRequest {
  limit: number
  offset: number
}

/** A reader over a fixed corpus that honours `limit` and `offset` like gscdump does. */
function readerOver(total: number, siteUrl = 'https://example.com/') {
  const requests: PageRequest[] = []
  const corpus: Row[] = Array.from({ length: total }, (_, index) => ({
    url: `https://example.com/page-${index}`,
  }))
  const read = async (page: PageRequest): Promise<IndexingUrlPage<Row>> => {
    requests.push(page)
    const urls = corpus.slice(page.offset, page.offset + page.limit)
    return {
      urls,
      pagination: {
        total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + urls.length < total,
      },
      meta: { siteUrl },
    }
  }
  return { read, requests }
}

describe('readIndexingUrlPages', () => {
  it('reads one page when the whole set fits', async () => {
    const { read, requests } = readerOver(120)

    const scan = await readIndexingUrlPages(read, { maxUrls: 2000 })

    expect(requests).toEqual([{ limit: INDEXING_URLS_PAGE_LIMIT, offset: 0 }])
    expect(scan).toMatchObject({ _tag: 'complete', siteUrl: 'https://example.com/' })
    expect(scan._tag === 'complete' && scan.urls).toHaveLength(120)
  })

  it('never asks for more rows than gscdump accepts', async () => {
    const { read, requests } = readerOver(1400)

    await readIndexingUrlPages(read, { maxUrls: 2000 })

    expect(requests.every(request => request.limit <= INDEXING_URLS_PAGE_LIMIT)).toBe(true)
  })

  it('pages through the set in order and keeps every row', async () => {
    const { read, requests } = readerOver(1400)

    const scan = await readIndexingUrlPages(read, { maxUrls: 2000 })

    expect(requests).toEqual([
      { limit: 500, offset: 0 },
      { limit: 500, offset: 500 },
      { limit: 500, offset: 1000 },
    ])
    if (scan._tag !== 'complete')
      throw new Error('expected a complete scan')
    expect(scan.urls).toHaveLength(1400)
    expect(scan.urls[0]!.url).toBe('https://example.com/page-0')
    expect(scan.urls.at(-1)!.url).toBe('https://example.com/page-1399')
  })

  it('reports truncation rather than a partial ranking above the cap', async () => {
    const { read } = readerOver(2600)

    const scan = await readIndexingUrlPages(read, { maxUrls: 2000 })

    expect(scan).toEqual({ _tag: 'truncated', loaded: 2000, total: 2600 })
  })

  it('stops when a page comes back empty, even if the reader still claims more', async () => {
    let calls = 0
    const read = async (page: PageRequest): Promise<IndexingUrlPage<Row>> => {
      calls++
      return {
        urls: page.offset === 0 ? [{ url: 'https://example.com/a' }] : [],
        pagination: { total: 99, limit: page.limit, offset: page.offset, hasMore: true },
        meta: { siteUrl: 'https://example.com/' },
      }
    }

    const scan = await readIndexingUrlPages(read, { maxUrls: 2000 })

    expect(calls).toBe(2)
    expect(scan).toEqual({ _tag: 'truncated', loaded: 1, total: 99 })
  })
})
