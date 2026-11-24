import { mockEvent } from 'nitro/h3'
import { describe, expect, it } from 'vitest'
import dataHandler from '../layers/pro-gsc/server/api/pro/public/demo/data.get'
import datesHandler from '../layers/pro-gsc/server/api/pro/public/demo/dates.get'

const eventFor = mockEvent

describe('gET /api/pro/public/demo/dates', () => {
  it('answers the shape the sample data card reads', async () => {
    const response = await datesHandler(eventFor('/api/pro/public/demo/dates?period=3m'))

    expect(response.dates.length).toBeGreaterThan(80)
    expect(Object.keys(response.dates[0]!).sort()).toEqual(['clicks', 'ctr', 'date', 'impressions', 'position'])
    expect(response.period.clicks).toBeGreaterThan(0)
    expect(response.period.impressions).toBeGreaterThan(response.period.clicks)
    expect(response.period.ctr).toBeGreaterThan(0)
    expect(response.period.position).toBeGreaterThan(0)
  })

  it('falls back to 28 days when the period is outside the allowlist', async () => {
    const clamped = await datesHandler(eventFor('/api/pro/public/demo/dates?period=custom:2020-01-01:2020-12-31'))
    const fallback = await datesHandler(eventFor('/api/pro/public/demo/dates?period=28d'))

    expect(clamped.dates).toHaveLength(fallback.dates.length)
    expect(clamped.dates).toHaveLength(28)
  })
})

describe('gET /api/pro/public/demo/data', () => {
  it('returns keyword rows for the queryCanonical dimension', async () => {
    const response = await dataHandler(eventFor('/api/pro/public/demo/data?dimension=queryCanonical&period=3m&limit=5'))

    expect(response.rows).toHaveLength(5)
    expect(response.rows.every(row => typeof row.keyword === 'string')).toBe(true)
    expect(response.rows.every(row => row.clicks > 0)).toBe(true)
  })

  it('returns page rows for the page dimension', async () => {
    const response = await dataHandler(eventFor('/api/pro/public/demo/data?dimension=page&period=3m&limit=5'))

    expect(response.rows).toHaveLength(5)
    expect(response.rows.every(row => typeof row.page === 'string')).toBe(true)
  })

  it('rejects a dimension the demo does not serve', async () => {
    const error = await Promise.resolve()
      .then(() => dataHandler(eventFor('/api/pro/public/demo/data?dimension=nonsense')))
      .catch((thrown: unknown) => thrown) as { statusCode: number }

    expect(error.statusCode).toBe(400)
  })

  it('rejects a limit above the allowed maximum', async () => {
    const error = await Promise.resolve()
      .then(() => dataHandler(eventFor('/api/pro/public/demo/data?limit=5000')))
      .catch((thrown: unknown) => thrown) as { statusCode: number }

    expect(error.statusCode).toBe(400)
  })
})
