import { checkUrlsIndexed, dataForSeoCallContext } from '~~/layers/core/server/app/services/dataforseo'
import { checkDataForSeoBudget } from '~~/layers/core/server/app/services/dataforseo-spend'
import { bulkCheckUrls } from '~~/shared/bulk-check'
import { checkFreeToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  await checkFreeToolRateLimit(event)

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

  const ctx = dataForSeoCallContext('bulk-check', event)
  // Each URL is one Live SERP call, so the run's cost scales with its size.
  const budget = await checkDataForSeoBudget({ tool: ctx.tool!, endpoint: '/serp/google/organic/live/advanced', taskCount: urls.length }, ctx)
  if (budget.blocked) {
    throw createError({
      statusCode: 429,
      message: 'Bulk index checking is at capacity for today. Please try again tomorrow.',
    })
  }

  const results = await checkUrlsIndexed(urls, ctx)

  const checked = results.filter(row => row._tag === 'Checked')
  const indexed = checked.filter(row => row.indexed).length

  return {
    summary: {
      total: results.length,
      indexed,
      notIndexed: checked.length - indexed,
      notChecked: results.length - checked.length,
      indexRate: checked.length > 0 ? Math.round((indexed / checked.length) * 100) : 0,
    },
    results,
    checkedAt: new Date().toISOString(),
  }
})
