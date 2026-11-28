import type { IndexCheckResult } from '~~/layers/core/server/app/services/site-search'
import { checkUrlIndexed, dataForSeoCallContext } from '~~/layers/core/server/app/services/dataforseo'
import { checkDataForSeoBudget } from '~~/layers/core/server/app/services/dataforseo-spend'
import {
  CHECK_INDEX_CACHE_TTL_SECONDS,
  normalizeToolUrlCacheKey,
  readToolResultCache,
  writeToolResultCache,
} from '~~/layers/core/server/app/services/tool-cache'
import { checkFreeToolRateLimit } from '#layers/pro-saas/server/utils/rate-limit'
import { classifyToolFailure, createBudgetExhaustedError, recordFreeToolWideEvent } from '../../utils/define-tool-handler'

export default defineEventHandler(async (event) => {
  try {
    await checkFreeToolRateLimit(event)

    const body = await readBody<{ url: string }>(event)

    if (!body?.url?.trim())
      throw createError({ statusCode: 400, message: 'URL is required' })

    const url = body.url.trim()

    let normalizedUrl = url
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://'))
      normalizedUrl = `https://${url}`

    if (!URL.canParse(normalizedUrl))
      throw createError({ statusCode: 400, message: 'Invalid URL format' })

    const storage = useStorage('cache')
    const cacheKey = normalizeToolUrlCacheKey(normalizedUrl)
    const cached = await readToolResultCache<IndexCheckResult & { checkedAt: string }>(storage, cacheKey)

    if (cached) {
      recordFreeToolWideEvent(event, 'check-index', 'success', {
        cached: true,
        urlCount: 1,
        resultCount: cached.indexed ? 1 : 0,
      })
      return {
        ...cached,
        cached: true,
      }
    }

    const ctx = dataForSeoCallContext('check-index', event)
    const budget = await checkDataForSeoBudget({ tool: ctx.tool!, endpoint: '/serp/google/organic/live/advanced', taskCount: 1 }, ctx)
    if (budget.blocked) {
      throw createBudgetExhaustedError('Index checking is at capacity for today. Try again tomorrow.')
    }

    const result = await checkUrlIndexed(normalizedUrl, ctx)
    const payload = {
      ...result,
      checkedAt: new Date().toISOString(),
    }

    await writeToolResultCache(storage, cacheKey, payload, CHECK_INDEX_CACHE_TTL_SECONDS)

    recordFreeToolWideEvent(event, 'check-index', 'success', {
      cached: false,
      urlCount: 1,
      resultCount: result.indexed ? 1 : 0,
    })

    return {
      ...payload,
      cached: false,
    }
  }
  catch (err) {
    recordFreeToolWideEvent(event, 'check-index', 'failure', {
      cached: false,
      failureProvenance: classifyToolFailure(err),
    })
    throw err
  }
})
