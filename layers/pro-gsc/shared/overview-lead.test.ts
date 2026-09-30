import { describe, expect, it } from 'vitest'
import { overviewLead } from './overview-lead'

const IMAGE_TOTALS = { clicks: 0, impressions: 1200 }

describe('overviewLead', () => {
  it('keeps the clicks lead on the web slice', () => {
    expect(overviewLead({ columns: ['clicks', 'impressions'], searchType: 'web', totals: { clicks: 0, impressions: 50 } }))
      .toEqual({ metric: 'clicks', heroColumns: ['clicks', 'impressions'] })
  })

  it('leads with impressions on a slice that has impressions and no clicks', () => {
    expect(overviewLead({ columns: ['clicks', 'impressions'], searchType: 'image', totals: IMAGE_TOTALS }))
      .toEqual({ metric: 'impressions', heroColumns: ['impressions', 'clicks'] })
  })

  it('keeps an explicit non-clicks choice on a clicks-less slice', () => {
    expect(overviewLead({ columns: ['position', 'impressions'], searchType: 'image', totals: IMAGE_TOTALS }))
      .toEqual({ metric: 'position', heroColumns: ['impressions', 'position'] })
  })

  it('keeps clicks on a non-web slice that earned clicks', () => {
    expect(overviewLead({ columns: ['clicks'], searchType: 'video', totals: { clicks: 3, impressions: 90 } }))
      .toEqual({ metric: 'clicks', heroColumns: ['clicks'] })
  })

  it('keeps clicks while the totals are unknown', () => {
    expect(overviewLead({ columns: ['clicks'], searchType: 'image', totals: null }))
      .toEqual({ metric: 'clicks', heroColumns: ['clicks'] })
  })

  it('leaves the hero order alone when impressions is not charted', () => {
    expect(overviewLead({ columns: ['clicks', 'ctr'], searchType: 'image', totals: IMAGE_TOTALS }))
      .toEqual({ metric: 'impressions', heroColumns: ['clicks', 'ctr'] })
  })

  it('falls back to clicks when no column is selected', () => {
    expect(overviewLead({ columns: [], searchType: 'web', totals: null }).metric).toBe('clicks')
  })
})
