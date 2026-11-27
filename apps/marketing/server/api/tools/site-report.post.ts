import type { DomainOverviewResult } from '~~/layers/core/server/app/services/dataforseo'
import { dataForSeoCallContext, getDomainOverview } from '~~/layers/core/server/app/services/dataforseo'
import { checkDataForSeoBudget } from '~~/layers/core/server/app/services/dataforseo-spend'
import {
  normalizeToolDomainCacheKey,
  readToolResultCache,
  SITE_REPORT_CACHE_TTL_SECONDS,
  writeToolResultCache,
} from '~~/layers/core/server/app/services/tool-cache'
import { checkFreeToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'
import { classifyToolFailure, createBudgetExhaustedError, recordFreeToolWideEvent } from '../../utils/define-tool-handler'

interface CachedSiteReport {
  domain: string
  overview: DomainOverviewResult
  healthScore: number
  recommendations: Array<{ type: 'critical' | 'warning' | 'info', title: string, description: string }>
  checkedAt: string
}

export default defineEventHandler(async (event) => {
  try {
    await checkFreeToolRateLimit(event)

    const body = await readBody<{ domain: string }>(event)

    if (!body?.domain?.trim())
      throw createError({ statusCode: 400, message: 'Domain is required' })

    const domain = body.domain.trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')

    if (!domain || domain.includes(' '))
      throw createError({ statusCode: 400, message: 'Invalid domain' })

    const storage = useStorage('cache')
    const cacheKey = normalizeToolDomainCacheKey(domain)
    const cached = await readToolResultCache<CachedSiteReport>(storage, cacheKey)

    if (cached) {
      recordFreeToolWideEvent(event, 'site-report', 'success', {
        cached: true,
        urlCount: 1,
        resultCount: cached.overview.estimatedIndexedPages,
      })
      return {
        ...cached,
        cached: true,
      }
    }

    const ctx = dataForSeoCallContext('site-report', event)
    // One SERP task (depth 100) + one Labs task.
    const budget = await checkDataForSeoBudget({ tool: ctx.tool!, endpoint: '/serp/google/organic/live/advanced', taskCount: 2 }, ctx)
    if (budget.blocked) {
      throw createBudgetExhaustedError('Site reports are at capacity for today. Try again tomorrow.')
    }

    const overview = await getDomainOverview(domain, ctx)

    // PRODUCT-08: Base score starts at 50 and adds points for positive signals (max 100).
    let healthScore = 50
    if (overview.estimatedIndexedPages > 0)
      healthScore += 20
    if (overview.organicTraffic !== null && overview.organicTraffic > 100)
      healthScore += 15
    if (overview.organicKeywords !== null && overview.organicKeywords > 10)
      healthScore += 15
    healthScore = Math.min(healthScore, 100)

    const recommendations: Array<{ type: 'critical' | 'warning' | 'info', title: string, description: string }> = []

    if (overview.estimatedIndexedPages === 0) {
      recommendations.push({
        type: 'critical',
        title: 'No indexed pages found',
        description: 'A Google site: search found no indexed pages for this domain. Check that robots.txt or a noindex tag is not blocking crawlers, and submit your sitemap in Search Console.',
      })
    }
    else if (overview.estimatedIndexedPages < 5) {
      const pageLabel = overview.estimatedIndexedPages === 1 ? '1 indexed page' : `${overview.estimatedIndexedPages} indexed pages`
      recommendations.push({
        type: 'warning',
        title: 'Low index coverage',
        description: `A Google site: search estimates ${pageLabel}. Check that your sitemap lists every page, and link new pages from pages Google already indexed.`,
      })
    }

    if (overview.organicTraffic === 0) {
      recommendations.push({
        type: 'warning',
        title: 'No organic traffic detected',
        description: 'DataForSEO Labs estimates no organic search traffic for this domain. Check Search Console for your actual clicks and impressions, and confirm your key pages are indexed.',
      })
    }

    if (overview.organicKeywords === 0) {
      recommendations.push({
        type: 'info',
        title: 'No ranking keywords detected',
        description: 'DataForSEO Labs found no ranking keywords for this domain. A page must be indexed before it can rank. First, check which pages Google indexed.',
      })
    }

    if (overview.estimatedIndexedPages > 0) {
      recommendations.push({
        type: 'info',
        title: 'See why pages are not indexed',
        description: 'Connect Search Console to see the reason Google gives for each URL. Google documents its Indexing API for job posting and livestream pages only.',
      })
    }

    const payload: CachedSiteReport = {
      domain,
      overview,
      healthScore,
      recommendations,
      checkedAt: new Date().toISOString(),
    }

    // Only cache when Labs metrics also succeeded, so a transient Labs blip does not stick.
    if (overview.organicTraffic !== null && overview.organicKeywords !== null) {
      await writeToolResultCache(storage, cacheKey, payload, SITE_REPORT_CACHE_TTL_SECONDS)
    }

    recordFreeToolWideEvent(event, 'site-report', 'success', {
      cached: false,
      urlCount: 1,
      resultCount: overview.estimatedIndexedPages,
    })

    return {
      ...payload,
      cached: false,
    }
  }
  catch (err) {
    recordFreeToolWideEvent(event, 'site-report', 'failure', {
      cached: false,
      failureProvenance: classifyToolFailure(err),
    })
    throw err
  }
})
