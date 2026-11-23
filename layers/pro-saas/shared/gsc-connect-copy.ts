/**
 * COPY.md, Connect Google assets. What the reader sees before and after the
 * Google consent screen. The access lines answer the question a one-person
 * tool raises before anyone hands it Google access: what it can read, what it
 * can change, and how to take the access back.
 */
export const GSC_CONNECT_COPY = {
  signupDescription: 'See which pages Google indexed and why others are missing. Free during beta.',
  accessHeading: 'What Request Indexing can access',
  /** COPY.md "Search Console read access". The saved-page setup uses it too. */
  readAccess: 'Setup asks for read-only Search Console access. If an action needs more access, we ask then.',
  /** COPY.md Truth rules, the Search Console access sentence, verbatim. */
  changes: 'We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify.',
  remove: 'You can remove this access at any time in your Google Account.',
  removeAction: 'Open Google Account connections',
  removeHref: 'https://myaccount.google.com/connections',
  signupMissingScope: 'Sign in again and tick the Search Console box on Google\'s screen so we can check your pages.',
  connectMissingScope: 'Connect again and tick the Search Console box on Google\'s screen so we can check your pages.',
  githubSignIn: 'Connect a Google account to read Search Console. You can still sign in with GitHub.',
  cancelled: {
    title: 'Search Console is not connected',
    description: 'Google did not grant access. Connect again so Request Indexing can check your pages.',
  },
  failed: {
    title: 'The Google connection did not finish',
    description: 'Google returned an error. Connect again so Request Indexing can check your pages.',
  },
} as const
