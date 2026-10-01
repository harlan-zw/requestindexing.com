// Every email this app sends is required or optional.
//
// A required email is about the account, such as a Free allowance notice. It
// always sends and carries no unsubscribe link.
//
// An optional email belongs to one category. A signed link or a one-click
// List-Unsubscribe request blocks that category for the address, and the
// sender reads the block at send time. The category names match nuxtseo.com,
// where `lifecycle` also holds the onboarding drip.

export const EMAIL_OPTOUT_CATEGORIES = ['lifecycle'] as const

export type EmailOptoutCategory = typeof EMAIL_OPTOUT_CATEGORIES[number]

export function parseEmailOptoutCategory(value: unknown): EmailOptoutCategory | null {
  return typeof value === 'string' && (EMAIL_OPTOUT_CATEGORIES as readonly string[]).includes(value)
    ? value as EmailOptoutCategory
    : null
}

/** The opt-out key for an address. Lowercase, because mail providers match addresses that way. */
export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase()
}
