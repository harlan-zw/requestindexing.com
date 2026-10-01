// The words the Account page, its delete dialog, and the page after a delete
// use. COPY.md records them under "Account deletion assets"; change them there
// first.
//
// No string here says Request Indexing revokes Google access. The delete
// revokes only the Google tokens this app stores. The Search Console grant goes
// to gscdump, and gscdump does not revoke a grant a partner's OAuth client
// issued, so that grant stays until the person removes it in their Google
// Account.
export const accountDeletionCopy = {
  blastRadius: 'Deleting your account removes every Team you own and all Sites and data in them. You also lose access to Teams you joined.',
  permanent: 'This cannot be undone.',
  engineRecord: 'gscdump.com, which Request Indexing runs on, deletes the record it keeps for your account. Your API keys stop working.',
  googleAccess: 'Google can keep the access you gave Request Indexing. Remove it in your Google Account.',
  googleAccessAction: 'Open Google Account connections',
  googleAccessUrl: 'https://myaccount.google.com/connections',
  deletedTitle: 'Your account is deleted',
  deleted: 'We deleted your Request Indexing account and its data.',
} as const

/** The page a deleted account lands on. The landing page reads the flag and confirms the delete. */
export const ACCOUNT_DELETED_PATH = '/?account_deleted=1'
