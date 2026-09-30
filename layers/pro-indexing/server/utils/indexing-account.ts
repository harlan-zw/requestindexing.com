import type { GoogleAccountsSelect } from '~~/layers/core/server/db/schema'
import { hasIndexingScope } from 'gscdump'

/**
 * The caller's `indexing` row, when it is a grant a Submission can use.
 *
 * Google's consent screen can return a token without the Indexing API scope.
 * A row holding one reads as granted, yet every Submission gets Google's 403,
 * which reads as an unverified property and hides the grant action. So the
 * status route and the submit route both read the row through here, and a row
 * without the scope is no grant at all.
 */
export function usableIndexingAccount<T extends Pick<GoogleAccountsSelect, 'tokens'>>(account: T | null | undefined): T | null {
  return account && hasIndexingScope(account.tokens.scope) ? account : null
}
