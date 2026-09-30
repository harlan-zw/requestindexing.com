import type { AccountStatus } from '@gscdump/contracts'
import type { H3Event } from 'h3'
import type { User } from '~~/layers/core/server/db/schema'
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'

module '#auth-utils' {
  export interface User {
    id: number
    email: string | null
    name: string | null
    avatarUrl: string | null
    authProvider: AuthProviderId
    currentTeamId: number | null
  }
  export interface UserSession {
    /**
     * When the user finished onboarding. Null means the dashboard sends them
     * through setup. It used to live on the team, so a second team looked
     * unonboarded to the same person.
     */
    onboardingCompletedAt?: string | null
    /**
     * Set when the user has completed the Search Console integration grant and
     * been registered with gscdump. Null means the dashboard has no data source
     * yet, which is what the connect prompt keys off.
     */
    gscdumpUserId?: string | null
    /**
     * True only when gscdump holds BOTH the user id and the per-user API key.
     * The id alone leaves every browser query failing, so the connect prompt
     * keys off this, not off `gscdumpUserId`.
     */
    gscdumpConnected?: boolean
    /**
     * gscdump's lifecycle account status, read by the session hook while
     * `gscdumpConnected` is true. Null when not read or when gscdump could not
     * answer. `resolveGscConnection` turns `scope_missing` into ScopeMissing.
     */
    gscdumpAccountStatus?: AccountStatus | null
    /** True when the current team owns at least one site. */
    hasSites?: boolean
    /**
     * Search Console grant state, published as one block by
     * `buildGscSessionFields`. `pro-gate.global.ts` and both
     * integration-readiness policies read these.
     */
    gscConnected?: boolean
    gscEmail?: string | null
    googleScopes?: string | null
    gscIndexingScope?: boolean
    gscSitemapsScope?: boolean
    /** Current team, populated by the session `fetch` hook. */
    team?: {
      teamId: number
      name: string
      personalTeam: boolean
    } | null
  }
}

module 'nitropack' {
  export interface NitroRuntimeHooks {
    'app:signUp': (event: H3Event, user: User) => void
  }
}

export {}
