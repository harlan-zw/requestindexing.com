import type { UserSelect } from '#shared/types/database'

// TODO(v1): google-auth-library not directly installed; UserOAuthToken kept as a minimal shape.
export interface UserOAuthToken {
  refresh_token: string
  access_token: string
  expiry_date: number
  scope: string
  token_type: string
  id_token: string
}

// export interface User {
//   email: string
//   userId: string
//   access?: 'pro'
//   picture: string
//   analyticsRange?: { start: Date, end: Date }
//   analyticsPeriod?: 'all' | '30d' | string
//   // onboarding
//   selectedSites?: string[]
//   backupsEnabled?: boolean
// }

export interface UserSession {
  sub: string
  user: UserSelect
  // used when redirecting to Indexing API OAuth
  googleIndexingAuth?: {
    /** Same-origin dashboard path, parsed by `safeAuthRedirect`. */
    returnTo: string
    state: string
  }
}

declare module '#auth-utils' {
  interface UserSession {
    googleIndexingAuth?: {
      returnTo: string
      state: string
    }
  }
}
