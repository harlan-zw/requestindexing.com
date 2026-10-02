import { dataForSeoCallContext, getDomainOverview } from '~~/layers/core/server/app/services/dataforseo'
import { checkDataForSeoBudget } from '~~/layers/core/server/app/services/dataforseo-spend'
import { checkFreeToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  await checkFreeToolRateLimit(event)

  const body = await readBody<{ domain: string }>(event)

  if (!body?.domain?.trim())
    throw createError({ statusCode: 400, message: 'Domain is required' })

  // Clean domain input
  const domain = body.domain.trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  if (!domain || domain.includes(' '))
    throw createError({ statusCode: 400, message: 'Invalid domain' })

  const ctx = dataForSeoCallContext('site-report', event)
  // One SERP task (depth 100) + one Labs task.
  const budget = await checkDataForSeoBudget({ tool: ctx.tool!, endpoint: '/serp/google/organic/live/advanced', taskCount: 2 }, ctx)
  if (budget.blocked) {
    throw createError({
      statusCode: 429,
      message: 'Site reports are at capacity for today. Please try again tomorrow.',
    })
  }

  const overview = await getDomainOverview(domain, ctx)

  // Calculate health score based on available data
  let healthScore = 50 // Base score
  if (overview.estimatedIndexedPages > 0)
    healthScore += 20
  if (overview.organicTraffic !== null && overview.organicTraffic > 100)
    healthScore += 15
  if (overview.organicKeywords !== null && overview.organicKeywords > 10)
    healthScore += 15
  healthScore = Math.min(healthScore, 100)

  // Generate recommendations
  const recommendations: Array<{ type: 'critical' | 'warning' | 'info', title: string, description: string }> = []

  if (overview.estimatedIndexedPages === 0) {
    recommendations.push({
      type: 'critical',
      title: 'No indexed pages found',
      description: 'Google does not appear to have any pages from this domain in its index. Ensure your site is not blocking crawlers and submit your sitemap.',
    })
  }
  else if (overview.estimatedIndexedPages < 5) {
    recommendations.push({
      type: 'warning',
      title: 'Low index coverage',
      description: `Only ${overview.estimatedIndexedPages} pages found in Google's index. Consider adding more quality content and submitting URLs via the Indexing API.`,
    })
  }

  if (overview.organicTraffic === 0) {
    recommendations.push({
      type: 'warning',
      title: 'No organic traffic detected',
      description: 'This domain doesn\'t appear to receive organic search traffic. Focus on content quality and keyword targeting.',
    })
  }

  if (overview.organicKeywords === 0) {
    recommendations.push({
      type: 'info',
      title: 'No ranking keywords detected',
      description: 'This domain isn\'t ranking for any tracked keywords. Build topical authority with targeted content.',
    })
  }

  if (overview.estimatedIndexedPages > 0) {
    recommendations.push({
      type: 'info',
      title: 'Submit unindexed pages via Indexing API',
      description: 'Use Request Indexing to submit your unindexed pages directly to Google for faster crawling and indexing.',
    })
  }

  return {
    domain,
    overview,
    healthScore,
    recommendations,
    checkedAt: new Date().toISOString(),
  }
})
