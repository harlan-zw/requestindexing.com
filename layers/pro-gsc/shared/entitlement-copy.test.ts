import type { MeteredEntitlements } from './free-allowance'
import { describe, expect, it } from 'vitest'
import { allowanceNoticeEmail, holdMessage, meterRows, refusalMessage } from './entitlement-copy'

function metered(overrides: Partial<MeteredEntitlements['meters']> = {}): MeteredEntitlements {
  return {
    mode: 'metered',
    phase: 'beta',
    meters: {
      sites: { used: 2, allowance: 3 },
      preservedRows: { used: 120_000, allowance: 250_000 },
      urlInspections: { used: 310, allowance: 5_000, resetsAt: '2026-11-01' },
      ...overrides,
    },
    sizeLimitRowsPerDay: 2_500,
    heldSites: [],
  }
}

describe('refusalMessage', () => {
  it.each([
    [{ reason: 'site_allowance', limit: 3 }, 'You have connected all 3 Sites in your Free allowance. Remove a Site to connect another.'],
    [{ reason: 'duplicate_property', siteUrl: 'sc-domain:example.com' }, 'This Search Console property is already connected as sc-domain:example.com. You can connect each property once.'],
    [{ reason: 'inspection_allowance', limit: 5_000, resetsAt: '2026-11-01' }, 'You used the 5,000 URL Inspections in this month\'s Free allowance. URL Inspection starts again on November 1.'],
    [{ reason: 'inspection_off' }, 'URL Inspection is off for this Site. Request Indexing cannot inspect its URLs right now.'],
  ] as const)('renders %o in Request Indexing copy', (refusal, message) => {
    expect(refusalMessage(refusal)).toBe(message)
  })

  it('explains a held Site with the hold reason, never with gscdump\'s Local mode advice', () => {
    const message = refusalMessage({ reason: 'site_held', hold: 'size_limit' })

    expect(message).toBe(holdMessage('size_limit'))
    expect(message).not.toMatch(/Local mode|CLI|Google keys/)
  })
})

describe('meterRows', () => {
  it('counts the Sites left while the allowance has room', () => {
    const [sites] = meterRows(metered({ sites: { used: 2, allowance: 3 } }))

    expect(sites).toMatchObject({ value: '2 of 3', detail: '1 more Site fits your Free allowance.', full: false })
  })

  it('says the allowance is full at the limit', () => {
    const [sites] = meterRows(metered({ sites: { used: 3, allowance: 3 } }))

    expect(sites).toMatchObject({ detail: 'Your Free allowance is full. Remove a Site to connect another.', full: true })
  })

  it('says Preserved rows are not counted yet when gscdump has no count', () => {
    const [, rows] = meterRows(metered({ preservedRows: { used: null, allowance: 250_000 } }))

    expect(rows).toMatchObject({ value: 'Not counted yet', percent: null, detail: 'Preserved rows are counted once a day.' })
  })

  it('shows URL Inspections with no cap as a count with no percent', () => {
    const [, , inspections] = meterRows(metered({ urlInspections: { used: 7_200, allowance: null, resetsAt: '2026-11-01' } }))

    expect(inspections).toMatchObject({
      value: '7,200',
      percent: null,
      full: false,
      detail: 'The count starts again on November 1. Your URL Inspections continue past the allowance.',
    })
  })
})

describe('allowanceNoticeEmail', () => {
  it('writes the 80% Sites notice', () => {
    const email = allowanceNoticeEmail(
      { userId: 'u_01', meter: 'sites', threshold: 80, used: 2, allowance: 3, period: '2026-10' },
      { manageSitesUrl: 'https://requestindexing.com/pro/dashboard/sites' },
    )

    expect(email.subject).toBe('Your Request Indexing account is near its Free allowance')
    expect(email.textBody).toContain('You have connected 2 of the 3 Sites in your Free allowance.')
    expect(email.textBody).toContain('Manage your Sites: https://requestindexing.com/pro/dashboard/sites')
  })

  it('dates the 100% URL Inspection notice to the first day of the next month', () => {
    const email = allowanceNoticeEmail(
      { userId: 'u_01', meter: 'url_inspections', threshold: 100, used: 5_000, allowance: 5_000, period: '2026-12' },
      { manageSitesUrl: 'https://requestindexing.com/pro/dashboard/sites' },
    )

    expect(email.subject).toBe('Your Request Indexing account reached its Free allowance')
    expect(email.textBody).toContain('Your Sites used all 5,000 URL Inspections in this month\'s Free allowance. Automatic URL Inspection stops until January 1.')
  })
})
