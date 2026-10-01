/**
 * The most URLs one Bulk Indexing Checker run checks, for a pasted list and a
 * sitemap alike. Each URL costs one DataForSEO Live SERP call, because a live
 * call takes one task.
 */
export const BULK_CHECK_URL_LIMIT = 10

/**
 * The URLs one bulk run checks, in input order. Each line is trimmed, a blank
 * line is dropped, `https://` is added where no protocol is given, and a
 * repeated URL counts once. Then the first `BULK_CHECK_URL_LIMIT` are kept.
 */
export function bulkCheckUrls(input: string[]): string[] {
  const urls = input
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`)
  return [...new Set(urls)].slice(0, BULK_CHECK_URL_LIMIT)
}
