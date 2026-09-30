// Every string this app shows for the Free allowance, a held Site, and an
// entitlement refusal. COPY.md ("Free allowance assets") is canonical: change a
// string there first, then here.
//
// gscdump sends its own message with each refusal, and that message points the
// reader to Local mode. A Request Indexing reader has no Local mode, so no
// gscdump message reaches the screen: every refusal renders from its tag.
import type { EntitlementRefusal, SiteHoldReason, UserAllowanceNoticeData } from '@gscdump/contracts'
import type { MeteredEntitlements } from './free-allowance'

export const FREE_ALLOWANCE_HEADING = 'Free allowance'
export const HELD_LABEL = 'Held'
export const HELD_TITLE = 'This Site is held'
export const FREE_ALLOWANCE_READ_FAILURE = 'Your Free allowance could not load. Retry to read it again.'

const SITES_FULL = 'Remove a Site to connect another.'

function count(value: number): string {
  return value.toLocaleString('en-US')
}

/** `2026-11-01` as `November 1`. The date is a UTC calendar day. */
export function formatAllowanceDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${isoDate}T00:00:00Z`))
}

/** The first day of the month after `period` (`YYYY-MM`), when a monthly count starts again. */
function nextPeriodStart(period: string): string {
  const [year, month] = period.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}

export function siteAllowanceSummary(used: number, allowance: number): string {
  return `${count(used)} of ${count(allowance)} Sites in your Free allowance.`
}

export function siteAllowanceReached(limit: number): string {
  return `You have connected all ${count(limit)} Sites in your Free allowance. ${SITES_FULL}`
}

export function holdMessage(hold: SiteHoldReason): string {
  switch (hold) {
    case 'size_limit':
      return 'This Site adds more Search Console rows each day than the Free allowance accepts. Its Search Console data is not imported.'
    case 'sitemap_limit':
      return 'The sitemaps of this Site list more URLs than the Free allowance accepts. Its Search Console data is not imported.'
    case 'size_unknown':
      return 'Request Indexing could not measure the size of this Site, so its Search Console data is not imported. Remove the Site and connect it again to retry.'
    case 'size_pending':
      return 'Request Indexing is measuring the size of this Site. The import of its Search Console data starts when the measurement succeeds.'
  }
}

export function refusalMessage(refusal: EntitlementRefusal): string {
  switch (refusal.reason) {
    case 'site_allowance':
      return siteAllowanceReached(refusal.limit)
    case 'duplicate_property':
      return `This Search Console property is already connected as ${refusal.siteUrl}. You can connect each property once.`
    case 'site_held':
      return holdMessage(refusal.hold)
    case 'inspection_off':
      return 'URL Inspection is off for this Site, so its index status does not update. To turn it on, email harlan@harlanzw.com.'
    case 'inspection_allowance':
      return `You used the ${count(refusal.limit)} URL Inspections in this month's Free allowance. URL Inspection starts again on ${formatAllowanceDate(refusal.resetsAt)}.`
  }
}

export interface MeterRow {
  key: 'sites' | 'preserved_rows' | 'url_inspections'
  label: string
  /** The count as the page prints it, for example `2 of 3`. */
  value: string
  /** Share of the allowance used, 0 to 100, or null when there is no cap or no count. */
  percent: number | null
  full: boolean
  detail: string
}

function percentOf(used: number, allowance: number): number {
  return allowance > 0 ? Math.min(100, Math.round(used / allowance * 100)) : 100
}

/** The Usage page rows, in the order COPY.md lists the meter labels. */
export function meterRows(entitlements: MeteredEntitlements): MeterRow[] {
  const { sites, preservedRows, urlInspections } = entitlements.meters
  const sitesLeft = Math.max(0, sites.allowance - sites.used)
  const resetsOn = formatAllowanceDate(urlInspections.resetsAt)

  return [
    {
      key: 'sites',
      label: 'Sites',
      value: `${count(sites.used)} of ${count(sites.allowance)}`,
      percent: percentOf(sites.used, sites.allowance),
      full: sitesLeft === 0,
      detail: sitesLeft === 0
        ? `Your Free allowance is full. ${SITES_FULL}`
        : `${count(sitesLeft)} more ${sitesLeft === 1 ? 'Site fits' : 'Sites fit'} your Free allowance.`,
    },
    preservedRows.used === null
      ? {
          key: 'preserved_rows',
          label: 'Preserved rows',
          value: 'Not counted yet',
          percent: null,
          full: false,
          detail: 'Preserved rows are counted once a day.',
        }
      : {
          key: 'preserved_rows',
          label: 'Preserved rows',
          value: `${count(preservedRows.used)} of ${count(preservedRows.allowance)}`,
          percent: percentOf(preservedRows.used, preservedRows.allowance),
          full: preservedRows.used >= preservedRows.allowance,
          detail: 'Search Console rows kept for your Sites.',
        },
    urlInspections.allowance === null
      ? {
          key: 'url_inspections',
          label: 'URL Inspections this month',
          value: count(urlInspections.used),
          percent: null,
          full: false,
          detail: `The count starts again on ${resetsOn}. Your URL Inspections continue past the allowance.`,
        }
      : {
          key: 'url_inspections',
          label: 'URL Inspections this month',
          value: `${count(urlInspections.used)} of ${count(urlInspections.allowance)}`,
          percent: percentOf(urlInspections.used, urlInspections.allowance),
          full: urlInspections.used >= urlInspections.allowance,
          detail: `The count starts again on ${resetsOn}.`,
        },
  ]
}

export interface AllowanceNoticeEmail {
  subject: string
  textBody: string
}

function noticeSentence(notice: UserAllowanceNoticeData): string {
  const used = count(notice.used)
  const allowance = count(notice.allowance)
  const reached = notice.threshold === 100
  switch (notice.meter) {
    case 'sites':
      return reached
        ? siteAllowanceReached(notice.allowance)
        : `You have connected ${used} of the ${allowance} Sites in your Free allowance.`
    case 'preserved_rows':
      return reached
        ? `Your Sites keep ${used} Preserved rows. The Free allowance covers ${allowance}. During beta, sync continues.`
        : `Your Sites keep ${used} Preserved rows of the ${allowance} in your Free allowance.`
    case 'url_inspections': {
      const resetsOn = formatAllowanceDate(nextPeriodStart(notice.period))
      return reached
        ? `Your Sites used all ${allowance} URL Inspections in this month's Free allowance. Automatic URL Inspection stops until ${resetsOn}.`
        : `Your Sites used ${used} of the ${allowance} URL Inspections in this month's Free allowance. The count starts again on ${resetsOn}.`
    }
  }
}

/** The email for a `user.allowance.notice` webhook. gscdump sends none to a partner's user. */
export function allowanceNoticeEmail(notice: UserAllowanceNoticeData, links: { manageSitesUrl: string }): AllowanceNoticeEmail {
  return {
    subject: notice.threshold === 100
      ? 'Your Request Indexing account reached its Free allowance'
      : 'Your Request Indexing account is near its Free allowance',
    textBody: `${noticeSentence(notice)}\n\nManage your Sites: ${links.manageSitesUrl}\n\nRequest Indexing\n`,
  }
}
