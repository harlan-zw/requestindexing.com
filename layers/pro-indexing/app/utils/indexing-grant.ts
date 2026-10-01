import type { GoogleSubmissionReceiptV1, GoogleSubmissionRefusal } from '@gscdump/contracts/v1'
import type { IndexingGrant } from '../../shared/contracts/indexing-grant'
import { parseGoogleSubmissionRefusal } from '@gscdump/contracts/v1'
import { withQuery } from 'ufo'

/**
 * The Indexing API grant route. Google sends the browser back to `returnTo`,
 * which the route accepts only as a same-origin dashboard path.
 */
export function indexingGrantHref(returnTo: string): string {
  return withQuery('/auth/google-indexing', { returnTo })
}

/** `missing`: the account never granted access. `rejected`: Google stopped accepting the stored grant. */
export type IndexingGrantRefusal = 'missing' | 'rejected'

/** The gscdump refusal on the submit route's error body, read from its details and never from prose. */
export function readSubmissionRefusal(error: unknown): GoogleSubmissionRefusal | null {
  return parseGoogleSubmissionRefusal((error as { data?: { data?: { refusal?: unknown } } } | undefined)?.data?.data?.refusal)
}

/** Whether a failed Submission is the grant. */
export function readIndexingGrantRefusal(error: unknown): IndexingGrantRefusal | null {
  const refusal = readSubmissionRefusal(error)
  if (refusal?.reason !== 'needs_indexing_api_grant')
    return null
  return refusal.grant === 'missing' ? 'missing' : 'rejected'
}

export type SubmitAction
  = | { _tag: 'Checking' }
    | { _tag: 'Submit' }
    | { _tag: 'GrantAccess', cause: IndexingGrantRefusal, to: string }

export interface SubmitActionInput {
  /** Null while the grant read is in flight. */
  grant: IndexingGrant | null
  /** The grant read failed. gscdump still refuses without a grant, so Submit stays. */
  grantUnavailable: boolean
  /** The submit route refused for a grant reason. Google is the authority, so this wins over the read. */
  refusal: IndexingGrantRefusal | null
  /** The page Google returns the browser to after the grant. */
  returnTo: string
}

/** The action beside the Page URL field: Submit, or the grant that Submit needs first. */
export function resolveSubmitAction(input: SubmitActionInput): SubmitAction {
  if (input.refusal)
    return { _tag: 'GrantAccess', cause: input.refusal, to: indexingGrantHref(input.returnTo) }
  if (input.grantUnavailable)
    return { _tag: 'Submit' }
  if (!input.grant)
    return { _tag: 'Checking' }
  if (input.grant._tag === 'missing')
    return { _tag: 'GrantAccess', cause: 'missing', to: indexingGrantHref(input.returnTo) }
  if (input.grant._tag === 'reauthorization-required')
    return { _tag: 'GrantAccess', cause: 'rejected', to: indexingGrantHref(input.returnTo) }
  return { _tag: 'Submit' }
}

const dayFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })
const formatDay = (value: string) => dayFormatter.format(new Date(value))

/** What the page says when gscdump refuses a Submission before it sends anything. */
export function describeSubmissionRefusal(refusal: GoogleSubmissionRefusal): string {
  switch (refusal.reason) {
    case 'indexing_api_unavailable':
      return 'Google Indexing API access is not set up for Request Indexing. Use IndexNow, or URL Inspection in Search Console.'
    case 'needs_indexing_api_grant':
      return refusal.grant === 'missing'
        ? 'Grant Indexing API access, then submit the URL.'
        : 'Google no longer accepts this access. Grant access again, then submit the URL.'
    case 'url_outside_site':
      return 'The URL must be on this Site.'
    case 'cooling_down':
      return `Google accepted this URL on ${formatDay(refusal.lastAcceptedAt)}. You can submit it again on ${formatDay(refusal.availableAt)}.`
    case 'site_daily_limit':
      return `This Site used its ${refusal.limit} Google Submissions for today. The daily limit resets at midnight Pacific Time.`
    case 'project_quota_spent':
      return 'Request Indexing used its Google quota for today. The quota resets at midnight Pacific Time.'
  }
}

/** What a Submission Receipt means. Acceptance is never indexing. */
export function describeReceipt(receipt: GoogleSubmissionReceiptV1): string {
  if (receipt._tag === 'accepted')
    return 'Google accepted the notification. This does not mean Google indexed the page.'
  if (receipt._tag === 'failed')
    return 'Google did not answer. Submit the URL again later.'
  switch (receipt.reason) {
    case 'not-owner':
      return 'Google refused it. The Google account that granted access must be an owner of this property in Search Console.'
    case 'access-revoked':
      return 'Google turned off Indexing API access for Request Indexing. No Submissions can be sent for now.'
    case 'quota-exhausted':
      return 'Google\'s quota for Request Indexing is spent. Try again after midnight Pacific Time.'
    case 'reauthorization-required':
      return 'Google no longer accepts this access. Grant access again, then submit the URL.'
  }
}
