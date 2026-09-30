import type { IndexingGrant } from '../../shared/contracts/indexing-grant'
import { withQuery } from 'ufo'
import { INDEXING_GRANT_INVALID_REASON, INDEXING_GRANT_MISSING_REASON } from '../../shared/contracts/indexing-grant'

/**
 * The Indexing API grant route. Google sends the browser back to `returnTo`,
 * which the route accepts only as a same-origin dashboard path.
 */
export function indexingGrantHref(returnTo: string): string {
  return withQuery('/auth/google-indexing', { returnTo })
}

/** `missing`: the account never granted access. `rejected`: Google stopped accepting the stored grant. */
export type IndexingGrantRefusal = 'missing' | 'rejected'

/**
 * Whether a failed Submission is the grant, read from the reason code on the
 * submit route's error body and never from its prose.
 */
export function readIndexingGrantRefusal(error: unknown): IndexingGrantRefusal | null {
  const reason = (error as { data?: { data?: { reason?: unknown } } } | undefined)?.data?.data?.reason
  if (reason === INDEXING_GRANT_MISSING_REASON)
    return 'missing'
  if (reason === INDEXING_GRANT_INVALID_REASON)
    return 'rejected'
  return null
}

export type SubmitAction
  = | { _tag: 'Checking' }
    | { _tag: 'Submit' }
    | { _tag: 'GrantAccess', cause: IndexingGrantRefusal, to: string }

export interface SubmitActionInput {
  /** Null while the grant read is in flight. */
  grant: IndexingGrant | null
  /** The grant read failed. The submit route still refuses without a grant, so Submit stays. */
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
  if (input.grant._tag === 'Missing')
    return { _tag: 'GrantAccess', cause: 'missing', to: indexingGrantHref(input.returnTo) }
  return { _tag: 'Submit' }
}
