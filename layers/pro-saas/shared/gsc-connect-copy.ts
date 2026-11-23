/**
 * COPY.md, Connect Google assets. What the reader sees before and after the
 * Google consent screen. The access lines answer the question a one-person
 * tool raises before anyone hands it Google access: what it can read, what it
 * can change, and how to take the access back.
 */
export const GSC_CONNECT_COPY = {
  accessHeading: 'What Google asks for',
  /** COPY.md "Search Console read access". The saved-page setup uses it too. */
  readAccess: 'Setup asks for read-only Search Console access. Extra permissions appear with the actions that need them.',
  /** COPY.md Truth rules, the Search Console access sentence, verbatim. */
  changes: 'We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify.',
  remove: 'You can remove this access at any time in your Google Account.',
  removeAction: 'Open Google Account connections',
  removeHref: 'https://myaccount.google.com/connections',
  cancelled: {
    title: 'Search Console is not connected',
    description: 'Google returned without Search Console access, so Request Indexing cannot read your data yet. Connect again when you are ready.',
  },
  failed: {
    title: 'The Google connection did not finish',
    description: 'Google returned an error, so Request Indexing cannot read your Search Console data yet. Connect again.',
  },
} as const
