import { describe, expect, it } from 'vitest'
import { classifyToolFailure } from '../apps/marketing/server/utils/define-tool-handler'
import { escapeCsvCell } from '../layers/core/app/composables/tools'
import { parseRateLimitError, toolErrorState } from '../layers/core/app/composables/useRateLimitError'
import { parseToolHistory } from '../layers/core/app/composables/useToolHistory'

describe('parseRateLimitError & toolErrorState', () => {
  it('strips raw ofetch wire messages so internal routes never leak to visitors', () => {
    const parsed = parseRateLimitError({
      statusCode: 500,
      message: '[POST] "/api/tools/check-index": 500 Internal Server Error',
    })
    expect(parsed.message).not.toContain('/api/tools/check-index')
    expect(parsed.rateLimitInfo).toBeUndefined()
  })

  it('extracts rate-limit headers and builds a rateLimited error state', () => {
    const resetUnix = Math.floor(Date.now() / 1000) + 120
    const parsed = parseRateLimitError({
      statusCode: 429,
      data: { message: 'Daily limit of 50 free checks exceeded. Resets at midnight UTC.' },
      response: {
        headers: new Headers({
          'x-ratelimit-limit': '50',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetUnix),
        }),
      },
    })

    expect(parsed.rateLimitInfo).toMatchObject({
      isRateLimited: true,
      isBudgetExhausted: false,
      limit: 50,
      remaining: 0,
    })
    expect(parsed.rateLimitInfo?.resetAt?.getTime()).toBe(resetUnix * 1000)
    expect(toolErrorState(parsed)).toMatchObject({
      _tag: 'rate-limited',
    })
  })

  it('marks daily provider budget exhaustion distinctly', () => {
    const parsed = parseRateLimitError({
      statusCode: 429,
      data: {
        message: 'Index checking is at capacity for today. Try again tomorrow.',
        data: { code: 'free_tool_budget_exhausted' },
      },
    })
    expect(parsed.rateLimitInfo?.isBudgetExhausted).toBe(true)
    expect(parsed.rateLimitInfo?.isRateLimited).toBe(true)
  })
})

describe('parseToolHistory', () => {
  it('deduplicates queries, enforces max limit, and filters mismatched tool entries', () => {
    const raw = JSON.stringify([
      { id: '1', tool: 'google-indexing-checker', query: 'https://a.com', createdAt: '2026-11-27T00:00:00Z' },
      { id: '2', tool: 'google-indexing-checker', query: 'https://a.com', createdAt: '2026-11-27T00:01:00Z' },
      { id: '3', tool: 'site-indexing-report', query: 'b.com', createdAt: '2026-11-27T00:02:00Z' },
      { id: '4', tool: 'google-indexing-checker', query: 'https://c.com', createdAt: '2026-11-27T00:03:00Z' },
      { id: '5', tool: 'google-indexing-checker', query: 'https://d.com', createdAt: 'not-a-date' },
    ])

    const items = parseToolHistory(raw, 2, 'google-indexing-checker')
    expect(items.map(i => i.query)).toEqual(['https://a.com', 'https://c.com'])
  })

  it('returns an empty list on corrupt JSON', () => {
    expect(parseToolHistory('{broken', 5, 'google-indexing-checker')).toEqual([])
  })
})

describe('escapeCsvCell', () => {
  it('doubles embedded quotes and neutralizes formula prefixes', () => {
    expect(escapeCsvCell('https://example.com/"quoted"')).toBe('"https://example.com/""quoted"""')
    expect(escapeCsvCell('=HYPERLINK("https://evil.test")')).toBe('"\'=HYPERLINK(""https://evil.test"")"')
    expect(escapeCsvCell('+1+1')).toBe('"\'+1+1"')
    expect(escapeCsvCell('Indexed')).toBe('"Indexed"')
  })
})

describe('classifyToolFailure', () => {
  it('classifies budget, rate-limit, validation, provider, and internal errors', () => {
    expect(classifyToolFailure({ statusCode: 429, data: { code: 'free_tool_budget_exhausted' } })).toBe('budget')
    expect(classifyToolFailure({ statusCode: 429 })).toBe('rate-limit')
    expect(classifyToolFailure({ statusCode: 400 })).toBe('validation')
    expect(classifyToolFailure({ statusCode: 503 })).toBe('provider')
    expect(classifyToolFailure(new Error('boom'))).toBe('internal')
  })
})
