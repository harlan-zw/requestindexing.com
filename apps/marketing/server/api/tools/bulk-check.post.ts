import type { BulkCheckRow } from '~~/layers/core/server/app/services/dataforseo'
import type { IndexCheckResult } from '~~/layers/core/server/app/services/site-search'
import { checkUrlsIndexed, dataForSeoCallContext } from '~~/layers/core/server/app/services/dataforseo'
import { checkDataForSeoBudget } from '~~/layers/core/server/app/services/dataforseo-spend'
import {
  CHECK_INDEX_CACHE_TTL_SECONDS,
  normalizeToolUrlCacheKey,
  readToolResultCache,
  writeToolResultCache,
} from '~~/layers/core/server/app/services/tool-cache'
import { bulkCheckUrls } from '~~/shared/bulk-check'
import { checkFreeToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'
import { classifyToolFailure, createBudgetExhaustedError, recordFreeToolWideEvent } from '../../utils/define-tool-handler'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ urls?: unknown, sitemapUrl?: unknown }>(event)

    let input: string[] = []

    if (typeof body?.sitemapUrl === 'string' && body.sitemapUrl.trim()) {
      try {
        input = await fetchSitemapUrlsFromXml(body.sitemapUrl.trim())
      }
      catch {
        throw createError({ statusCode: 400, message: 'Could not fetch or parse the sitemap URL' })
      }
    }
    else if (Array.isArray(body?.urls) && body.urls.length) {
      input = body.urls.filter((url): url is string => typeof url === 'string')
    }
    else {
      throw createError({ statusCode: 400, message: 'Provide either a list of URLs or a sitemap URL' })
    }

    // The cap applies to a pasted list and a sitemap alike.
    const urls = bulkCheckUrls(input)

    if (urls.length === 0)
      throw createError({ statusCode: 400, message: 'No valid URLs found' })

    for (const url of urls) {
      if (!URL.canParse(url))
        throw createError({ statusCode: 400, message: `Invalid URL: ${url}` })
    }

    const storage = useStorage('cache')
    const cachedByUrl = new Map<string, IndexCheckResult>()
    const uncachedUrls: string[] = []

    await Promise.all(urls.map(async (url) => {
      const cached = await readToolResultCache<IndexCheckResult>(storage, normalizeToolUrlCacheKey(url))
      if (cached && typeof cached.indexed === 'boolean')
        cachedByUrl.set(url, cached)
      else
        uncachedUrls.push(url)
    }))

    // Weight daily rate limit by uncached URLs (minimum 1 per call) so bulk runs
    // match single-URL cost fairness without penalizing cache hits.
    await checkFreeToolRateLimit(event, { cost: Math.max(1, uncachedUrls.length) })

    const freshByUrl = new Map<string, BulkCheckRow>()
    if (uncachedUrls.length > 0) {
      const ctx = dataForSeoCallContext('bulk-check', event)
      const budget = await checkDataForSeoBudget({ tool: ctx.tool!, endpoint: '/serp/google/organic/live/advanced', taskCount: uncachedUrls.length }, ctx)
      if (budget.blocked) {
        throw createBudgetExhaustedError('Bulk index checking is at capacity for today. Try again tomorrow.')
      }

      const freshRows = await checkUrlsIndexed(uncachedUrls, ctx)
      const checkedAt = new Date().toISOString()
      await Promise.all(freshRows.map(async (row) => {
        freshByUrl.set(row.url, row)
        if (row._tag === 'Checked') {
          const { _tag: _, ...checkResult } = row
          await writeToolResultCache(storage, normalizeToolUrlCacheKey(row.url), { ...checkResult, checkedAt }, CHECK_INDEX_CACHE_TTL_SECONDS)
        }
      }))
    }

    const results: BulkCheckRow[] = urls.map((url) => {
      const cached = cachedByUrl.get(url)
      if (cached)
        return { _tag: 'Checked', ...cached }
      return freshByUrl.get(url) ?? { _tag: 'NotChecked', url }
    })

    const checked = results.filter(row => row._tag === 'Checked')
    const indexed = checked.filter(row => row.indexed).length

    recordFreeToolWideEvent(event, 'bulk-check', 'success', {
      cached: uncachedUrls.length === 0,
      urlCount: results.length,
      resultCount: indexed,
    })

    return {
      summary: {
        total: results.length,
        indexed,
        notIndexed: checked.length - indexed,
        notChecked: results.length - checked.length,
        indexRate: checked.length > 0 ? Math.round((indexed / checked.length) * 100) : 0,
      },
      results,
      cachedCount: cachedByUrl.size,
      checkedAt: new Date().toISOString(),
    }
  }
  catch (err) {
    recordFreeToolWideEvent(event, 'bulk-check', 'failure', {
      cached: false,
      failureProvenance: classifyToolFailure(err),
    })
    throw err
  }
})
