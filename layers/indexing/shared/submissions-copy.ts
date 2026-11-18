// COPY.md: "Submissions assets" and the automatic sending rows of "IndexNow
// dashboard assets". Change a string there first, then here. The Submissions
// card itself takes its strings from `@nuxtseo/pro-indexing`, with this app's
// overrides in `layers/indexing/app/pro-indexing.ts`.

import type { GoogleSubmissionReceiptV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import type { AutomaticSendingCheck, AutomaticSendingView } from './submissions'

/** One label per receipt state. The IndexNow page and Submit to Google share them. */
export const INDEXNOW_RECEIPT_LABELS: Record<IndexNowSubmissionReceiptV1['_tag'], string> = {
  queued: 'Queued',
  accepted: 'Notification accepted',
  pending: 'Key validation pending',
  rejected: 'Rejected',
  retrying: 'Retry scheduled',
  failed: 'Failed',
}

export const GOOGLE_RECEIPT_LABELS: Record<GoogleSubmissionReceiptV1['_tag'], string> = {
  accepted: 'Accepted',
  rejected: 'Refused',
  failed: 'No answer',
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })
const numberFormatter = new Intl.NumberFormat('en')

export function formatSubmissionDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

export const SUBMISSIONS_COPY = {
  heading: 'Submissions',
  intro: 'A Submission notifies a search engine that a page is new or changed. Each search engine decides whether to index it.',
  backLink: 'All Submissions',
  missingSite: 'Connect this Site to see its Submissions.',
  retry: 'Retry loading',
  channelHeadings: { google: 'Google Indexing API', indexnow: 'IndexNow', sitemap: 'Sitemap submission' },
  indexNowNoKey: 'No IndexNow key yet.',
  indexNowVerify: 'Verify your key before submitting URLs.',
  indexNowVerified: 'Key verified',
  indexNowReadFailure: 'IndexNow setup could not load. Retry to read the engine state.',
  sitemapLink: 'Open Sitemaps',
  googleLink: 'Submit to Google',
  indexNowLink: 'Submit with IndexNow',
  automaticBadge: 'Automatic',
} as const

export const AUTOMATIC_SENDING_COPY = {
  label: 'Automatic sending',
  description: 'Send new and changed sitemap URLs to IndexNow after each sitemap update. Only changes found after it turns on are sent.',
  off: 'Automatic sending is off.',
  waitingForKey: 'Automatic sending is on. It starts after your key is verified.',
  noCheck: 'Automatic sending is on. No sitemap update has been checked yet.',
  dailyLimit: 'Some changed URLs were not sent, because this Site reached its daily limit for automatic sending. They do not wait for the next check.',
  scanLimit: 'Some changed URLs were not sent, because the check reached its scan limit. They do not wait for the next check.',
  verified: 'Key verified. You can submit URLs.',
  verifiedTurnedOn: 'Key verified. Automatic sending is on.',
  verifiedTurnOnFailed: 'Key verified. Automatic sending did not turn on. Turn it on below.',
  changeFailed: 'Automatic sending did not change. Try the switch again.',
  needsKey: 'Save your IndexNow key before you turn on automatic sending.',
} as const

export function automaticLastCheck(check: AutomaticSendingCheck): string {
  return `Last check ${formatSubmissionDate(check.checkedAt)}: ${numberFormatter.format(check.changedUrls)} changed URLs found, ${numberFormatter.format(check.sentUrls)} sent.`
}

/** Every line that describes the automatic sending state, in reading order. */
export function describeAutomaticSending(view: AutomaticSendingView): string[] {
  switch (view._tag) {
    case 'needs-key':
      return [AUTOMATIC_SENDING_COPY.needsKey]
    case 'off':
      return [AUTOMATIC_SENDING_COPY.off]
    case 'waiting-for-key':
      return [AUTOMATIC_SENDING_COPY.waitingForKey]
    case 'on': {
      if (!view.lastCheck)
        return [AUTOMATIC_SENDING_COPY.noCheck]
      const lines = [automaticLastCheck(view.lastCheck)]
      if (view.lastCheck.completeness._tag === 'truncated') {
        if (view.lastCheck.completeness.reasons.includes('daily-limit'))
          lines.push(AUTOMATIC_SENDING_COPY.dailyLimit)
        if (view.lastCheck.completeness.reasons.includes('scan-limit'))
          lines.push(AUTOMATIC_SENDING_COPY.scanLimit)
      }
      return lines
    }
  }
}
