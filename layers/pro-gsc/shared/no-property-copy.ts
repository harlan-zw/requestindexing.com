// The words for a Google account with no Search Console property.
//
// PR #181 wrote this state for the property list on Connect a Site and for the
// Integrations row. The pages that offer Connect a Site with no Site connected
// said nothing about it, so the reader clicked Connect and waited to find out
// (2026-10-01 replay, N6). Every surface now reads these strings.
//
// The strings are canonical in COPY.md ("Connect a Site assets"). Change them
// there first.

export const SEARCH_CONSOLE_URL = 'https://search.google.com/search-console'
export const VERIFY_SITE_HELP_URL = 'https://support.google.com/webmasters/answer/9008080'

/** "No property, title". `email` is the Google account of the Search Console grant. */
export function noPropertyTitle(email: string | null | undefined): string {
  return `${email || 'This Google account'} has no Search Console property`
}

/** "No property, detail": under the property list, next to Refresh list. */
export const NO_PROPERTY_DETAIL = 'Add and verify your site here, or add it in Search Console and refresh this list. If a different Google account owns the property, connect that account.'

/** "No property, detail outside the list": every page with no property list to refresh. */
export const NO_PROPERTY_DETAIL_OUTSIDE_LIST = 'Add and verify your site here or in Search Console. If a different Google account owns the property, connect that account.'

/** "No property, actions". The first one, Add and verify, is `ADD_VERIFY_ACTION` in `add-verify-copy.ts`. */
export const NO_PROPERTY_ACTIONS = {
  openSearchConsole: 'Open Search Console',
  connectAnotherAccount: 'Connect another Google account',
  howToVerify: 'How to verify a site',
} as const

/** "Integrations, no property": the status line of the Search Console row. */
export const INTEGRATIONS_NO_PROPERTY = 'Connected. This Google account has no Search Console property.'
