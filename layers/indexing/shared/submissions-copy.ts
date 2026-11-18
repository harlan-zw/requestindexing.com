// COPY.md: "Submissions assets" and the automatic sending rows of "IndexNow
// dashboard assets". Change a string there first, then here.

import type { GoogleSubmissionReceiptV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1'
import type { AutomaticSendingCheck, AutomaticSendingView, SubmissionAnswer, SubmissionReceiptState } from './submissions'

/** One label per receipt state. The IndexNow page, Submit to Google and Submissions share them. */
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

export function receiptLabel(state: SubmissionReceiptState): string {
  return state.channel === 'indexnow' ? INDEXNOW_RECEIPT_LABELS[state.tag] : GOOGLE_RECEIPT_LABELS[state.tag]
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
  sentHeading: 'Sent to search engines',
  sentWindow: 'Last 30 days',
  channelNames: { indexnow: 'IndexNow', google: 'Google Indexing API' },
  columns: { urls: 'URLs sent', accepted: 'Accepted', waiting: 'Waiting', notAccepted: 'Not accepted' },
  sentEmpty: 'No Submissions in the last 30 days.',
  receiptExplanation: 'A receipt records the notification outcome. Search engines decide whether to index each URL.',
  receiptReadFailure: 'Submission receipts could not load. Retry to read the latest outcomes.',
  retry: 'Retry loading',
  afterwardsHeading: 'Afterwards in Google',
  afterwardsExplanation: 'Google\'s latest URL Inspection result for each URL sent in the last 30 days. A result counts only when Google inspected the URL after it was sent. It shows order in time, not cause. IndexNow does not notify Google.',
  afterwardsReadFailure: 'Google\'s URL Inspection results could not load. Retry to read them again.',
  outcomes: {
    indexed: 'Indexed',
    notIndexed: 'Not indexed',
    noVerdict: 'No index verdict',
    notInspectedSince: 'Not inspected since',
    noResult: 'No URL Inspection result',
    noResultDetail: 'Request Indexing reads results for the URLs in your sitemaps.',
    notRead: 'Not read',
    notReadDetail: 'Many inspected URLs contain this address. Find it on the URLs page.',
    readFailedDetail: 'This result could not load. Retry to read it again.',
  },
  channelHeadings: { google: 'Google Indexing API', indexnow: 'IndexNow', sitemap: 'Sitemap submission' },
  googleNone: 'No Submissions yet.',
  indexNowNoKey: 'No IndexNow key yet.',
  indexNowVerify: 'Verify your key before submitting URLs.',
  indexNowVerified: 'Key verified',
  indexNowReadFailure: 'IndexNow setup could not load. Retry to read the engine state.',
  sitemapLink: 'Open Sitemaps',
  urlsLink: 'View every inspected URL',
  googleLink: 'Submit to Google',
  indexNowLink: 'Submit with IndexNow',
  automaticBadge: 'Automatic',
} as const

export function sentByAutomaticSending(count: number): string {
  return `Automatic sending sent ${numberFormatter.format(count)} of them.`
}

export function sentScopeCapped(limit: number): string {
  return `Counted from the latest ${numberFormatter.format(limit)} receipts of each channel. Older Submissions in this window are not counted.`
}

export function afterwardsScope(count: number): string {
  return `The latest ${numberFormatter.format(count)} URLs sent.`
}

export function afterwardsSent(date: string): string {
  return `Sent ${formatSubmissionDate(date)}`
}

export function afterwardsInspected(date: string): string {
  return `Inspected ${formatSubmissionDate(date)}`
}

export function afterwardsNotInspectedSince(date: string): string {
  return `Last inspected ${formatSubmissionDate(date)}, before this Submission.`
}

export function googleLastSubmission(date: string): string {
  return `Last Submission ${formatSubmissionDate(date)}`
}

/** The status colour of each answer group. */
export const SUBMISSION_ANSWER_STATUS: Record<SubmissionAnswer, 'success' | 'neutral' | 'error'> = {
  'accepted': 'success',
  'waiting': 'neutral',
  'not-accepted': 'error',
}

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
