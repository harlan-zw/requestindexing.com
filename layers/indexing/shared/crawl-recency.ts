// Crawl-recency histogram (Indexing Recovery Engine T3.1).
//
// `lastCrawlTime` is already fetched (and retained) on each URL-Inspection sample
// row — nothing read it. This buckets those timestamps into a recency histogram
// so a diagnosis can say "Google last crawled most of these months ago" (a stale
// crawl is itself a crawl-demand signal). It rides the ~15-enriched-rows/assessment
// URL-Inspection sample, so it carries a MANDATORY sample-size caption and is never
// presented as a whole-site verdict (the same trap as the old false "100% indexed").

export interface CrawlRecencyHistogram {
  /** URLs Google crawled within 7 days. */
  within7d: number
  /** 8-30 days ago. */
  within30d: number
  /** 31-90 days ago. */
  within90d: number
  /** More than 90 days ago — a stale crawl. */
  over90d: number
  /** Rows with no `lastCrawlTime` (never crawled, or not reported). */
  unknown: number
  /** Total rows the histogram is over — the denominator the caption must cite. */
  sampleSize: number
  /** Mandatory representativeness caption; never drop it when rendering. */
  caption: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Bucket sample-row `lastCrawlTime`s into a recency histogram. `now` is injectable
 * for deterministic tests. Returns an all-zero histogram (sampleSize 0) when there
 * are no rows.
 */
export function buildCrawlRecencyHistogram(
  rows: ReadonlyArray<{ lastCrawlTime?: string | null }>,
  now: Date = new Date(),
): CrawlRecencyHistogram {
  const h = { within7d: 0, within30d: 0, within90d: 0, over90d: 0, unknown: 0 }
  for (const row of rows) {
    const t = row.lastCrawlTime ? Date.parse(row.lastCrawlTime) : Number.NaN
    if (Number.isNaN(t)) {
      h.unknown++
      continue
    }
    const days = (now.getTime() - t) / DAY_MS
    if (days <= 7)
      h.within7d++
    else if (days <= 30)
      h.within30d++
    else if (days <= 90)
      h.within90d++
    else
      h.over90d++
  }
  const sampleSize = rows.length
  return {
    ...h,
    sampleSize,
    caption: sampleSize > 0
      ? `Crawl recency over ${sampleSize} URL-Inspection-sampled URL${sampleSize === 1 ? '' : 's'} (a sample under Google's daily inspection cap, not a whole-site figure).`
      : 'No URL-Inspection samples available to measure crawl recency.',
  }
}
