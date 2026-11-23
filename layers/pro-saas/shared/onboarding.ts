// The onboarding decision layer. Pure data in, pure data out, so the route
// middleware, the wizard page and the completion endpoint all read one rule set
// instead of three copies that drift.
//
// The flow is nuxtseo.com's URL-driven wizard cut to what this product does.
// Agent setup leads, as in nuxtseo.com (decided 2026-11-24, COPY.md Agent
// setup assets). Google Search Console is the only integration, there is no
// billing and there are no invites, so `plan` and `invite` are gone and `integrations` folds into
// `connect`. nuxtseo.com's `help` step is not a step here: its questions sit on
// the `sync` step as the optional "About you" card (Onboarding Answers), so they
// add no time and never gate completion.
//
// The steps register on `@nuxtseo/pro-shell`'s Step registry
// (`app/plugins/onboarding-steps.ts`), and its pure resolver picks the current
// one. This file keeps what the shell leaves to the site: the Step states, the
// gate, and the completion rule.

import type { AccountStatus } from '@gscdump/contracts'
import type { ProShellOnboardingStep } from '@nuxtseo/pro-shell/shared/onboarding'
import type { AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import type { GscCallbackError } from '#layers/pro-gsc/shared/gsc-grant'
import { evaluateOnboardingSteps, resolveOnboarding, STEP_COMPLETE, STEP_OPTIONAL, STEP_PENDING } from '@nuxtseo/pro-shell/shared/onboarding'
import { isGscScopeMissingError } from '#layers/pro-gsc/shared/gsc-grant'
import { PAGE_TASK_ROUTE } from './page-task'

/** Where a signed-out visitor starts. Renders the provider buttons. */
export const ONBOARDING_ENTRY_ROUTE = '/pro/onboarding'

/**
 * The wizard. It sits under `/pro/dashboard` so one auth gate covers it, and
 * the onboarding gate exempts it so it can never redirect onto itself.
 */
export const ONBOARDING_ROUTE = '/pro/dashboard/onboarding'

/**
 * Where a new signup lands: Agent setup. A saved page outranks it
 * (`finalize.ts`), and Skip agent setup moves on to Connect Google.
 */
export const ONBOARDING_AGENT_SETUP_PATH = `${ONBOARDING_ROUTE}?step=agent`

/** Where a finished user lands. */
export const DASHBOARD_ROUTE = '/pro/dashboard'

/**
 * Where a finished user connects a Site. The wizard is closed to them, so this
 * page renders the same form, and a Google grant started here returns here.
 */
export const CONNECT_SITE_ROUTE = '/pro/dashboard/sites/connect'

/**
 * Paths a user may reach while onboarding is unfinished. Without the account
 * pages here, a half-onboarded user cannot sign out or delete their account.
 */
export const ONBOARDING_EXEMPT_PREFIXES = [
  PAGE_TASK_ROUTE,
  '/pro/dashboard/account',
  '/account',
  ONBOARDING_ROUTE,
] as const

export const ONBOARDING_STEPS = ['agent', 'connect', 'sites', 'sync'] as const

export type OnboardingStep = typeof ONBOARDING_STEPS[number]

/** COPY.md: setup completion describes the setup, never an unread sync lifecycle. */
export const ONBOARDING_COMPLETION_COPY = {
  connected: {
    title: 'You\'re set up',
    description: 'Open the dashboard to see what Google has reported about your Sites.',
  },
  missingSite: {
    title: 'Connect a Site to finish setup',
    description: 'Go back to Connect Sites and choose a Search Console property.',
  },
} as const

/** Parse an untrusted `?step=` value once, at the boundary. */
export function parseOnboardingStep(value: unknown): OnboardingStep | null {
  if (typeof value !== 'string')
    return null
  return (ONBOARDING_STEPS as readonly string[]).includes(value) ? value as OnboardingStep : null
}

/**
 * The user's Search Console connection, as the wizard sees it.
 *
 * `ScopeMissing` is its own state because a boolean read it as connected: an
 * account keeps its gscdump key from an earlier grant, so a user who just
 * unticked Search Console on Google's consent screen looked finished.
 */
export type GscConnection
  = | { _tag: 'Connected' }
    | { _tag: 'ScopeMissing' }
    | { _tag: 'NotConnected' }

export interface GscConnectionInput {
  /** gscdump holds a user id and key for this account. */
  gscdumpConnected: boolean
  /**
   * gscdump's account status, as the session read it. Null when it was not
   * read or the read failed; the stored credential then decides.
   */
  accountStatus: AccountStatus | null
  /** The untrusted `?error=` value the OAuth callback returned with. */
  error: unknown
}

/**
 * The callback's verdict outranks the stored credential. It is the only
 * evidence about the grant Google returned a moment ago. Without it, gscdump's
 * account status does: a user who unticked Search Console before the callback
 * checked the grant still holds a key, and only gscdump knows it is unusable.
 *
 * Only `scope_missing` maps to ScopeMissing, whose alert tells the user to
 * tick a box. `reauth_required`, `refresh_missing` and `disconnected` read as
 * NotConnected: the key is stored but cannot read, so the wizard offers
 * Connect again, as `hasUsableGoogleGrant` and the finish route expect.
 */
export function resolveGscConnection(input: GscConnectionInput): GscConnection {
  if (isGscScopeMissingError(input.error) || input.accountStatus === 'scope_missing')
    return { _tag: 'ScopeMissing' }
  return hasUsableGoogleGrant(input) ? { _tag: 'Connected' } : { _tag: 'NotConnected' }
}

/** gscdump account states in which a stored engine key cannot read Search Console. */
const UNUSABLE_GRANT_STATUSES: ReadonlySet<AccountStatus> = new Set(['scope_missing', 'reauth_required', 'refresh_missing', 'disconnected'])

/**
 * Whether the account's Google grant can read Search Console now. A stored
 * key is necessary but not enough: gscdump's account status can say the grant
 * behind it lost its scope or its refresh token. An unknown status (not read,
 * or the read failed) leaves the stored key to decide.
 */
export function hasUsableGoogleGrant(input: { gscdumpConnected: boolean, accountStatus: AccountStatus | null }): boolean {
  return input.gscdumpConnected && !(input.accountStatus && UNUSABLE_GRANT_STATUSES.has(input.accountStatus))
}

/** The signals every Onboarding Step reads, augmented onto the shell's context. */
declare module '@nuxtseo/pro-shell/shared/onboarding' {
  interface ProShellOnboardingContext {
    gsc: GscConnection
    /** The user's current team owns at least one site. */
    hasSites: boolean
    /**
     * Nothing on the sites step can connect: the property list offers no
     * verified property, a connect attempt failed, or the Free allowance is
     * full.
     */
    connectBlocked: boolean
  }
}

export const FIRST_RUN_FLOW = 'first-run'
export const DASHBOARD_CARD_FLOW = 'dashboard-card'

/**
 * The first-run wizard as Onboarding Steps for `@nuxtseo/pro-shell`'s Step
 * registry. No component: the page fills each `#step-<id>` slot. Copy lives
 * under `proShell.copy.onboarding.steps` (COPY.md, Setup steps).
 *
 * Connect Google is required, unless the Team already has a Site. This
 * departs from nuxtseo.com ADR-0035, which offers a skip: Harlan removed it
 * on 2026-11-19, after 16 of the 34 signups who never connected left through
 * it onto an empty dashboard and none signed in again.
 *
 * - `agent` (Agent setup) is `Optional`, so resume never lands there. A new
 *   signup opens it by URL (`ONBOARDING_AGENT_SETUP_PATH`). Skip agent setup
 *   goes to `connect` and keeps progress. Every agent route still passes
 *   Connect Google.
 * - `connect` is `Optional` once a Site exists, so a member of a Team that
 *   already has one is never sent back to it. Before any Site it is
 *   `Pending`, so a fresh account starts on it. It has no skip: its only way
 *   forward is Connect Google Search Console, then Continue.
 * - `sites` needs a Site. Its skip ("Skip and connect it later") shows only
 *   for a connected account whose connecting is blocked, so it never reads as
 *   the first choice and never stands in for Connect Google. It draws its own
 *   Continue, disabled until a Site exists.
 * - `sync` is terminal. Next finishes setup. It uses the frame's nav, which
 *   the onboarding page disables until a Site exists, because finishing
 *   without one is refused.
 */
export const FIRST_RUN_STEPS: readonly ProShellOnboardingStep[] = [
  {
    id: 'agent',
    flow: FIRST_RUN_FLOW,
    order: 5,
    titleKey: 'agent',
    nav: 'step',
    state: () => STEP_OPTIONAL,
    skip: () => true,
  },
  {
    id: 'connect',
    flow: FIRST_RUN_FLOW,
    order: 10,
    titleKey: 'connect',
    nav: 'step',
    state: (ctx) => {
      if (ctx.gsc._tag === 'Connected')
        return STEP_COMPLETE
      return ctx.hasSites ? STEP_OPTIONAL : STEP_PENDING
    },
  },
  {
    id: 'sites',
    flow: FIRST_RUN_FLOW,
    order: 20,
    titleKey: 'sites',
    nav: 'step',
    state: ctx => ctx.hasSites ? STEP_COMPLETE : STEP_PENDING,
    skip: ctx => !ctx.hasSites && ctx.connectBlocked && ctx.gsc._tag === 'Connected',
  },
  {
    id: 'sync',
    flow: FIRST_RUN_FLOW,
    order: 30,
    titleKey: 'sync',
    state: () => STEP_PENDING,
  },
]

/**
 * The dashboard home's setup card. With no Site the card offers Connect a
 * Site; with one, it offers Search Console until the account connects it. A
 * missing scope is not offered here: the layout's alert says so.
 */
export const DASHBOARD_CARD_STEPS: readonly ProShellOnboardingStep[] = [
  {
    id: 'connect-site',
    flow: DASHBOARD_CARD_FLOW,
    order: 10,
    titleKey: 'connect-site',
    link: { route: 'addSite' },
    state: ctx => ctx.hasSites ? STEP_COMPLETE : STEP_PENDING,
  },
  {
    id: 'connect-search-console',
    flow: DASHBOARD_CARD_FLOW,
    order: 20,
    titleKey: 'connect-search-console',
    link: { route: 'searchConsole' },
    state: ctx => ctx.hasSites && ctx.gsc._tag === 'NotConnected' ? STEP_PENDING : STEP_COMPLETE,
  },
]

export interface OnboardingResumeSignals {
  gsc: GscConnection
  /** The user's current team owns at least one site. */
  hasSites: boolean
}

/**
 * The step a half-onboarded user resumes at, inferred from persisted state.
 * There is no "current step" column, so a Google round trip or a closed tab
 * cannot strand the user on a step they already finished.
 *
 * The shell's resolver answers it over the same steps the wizard draws, so the
 * gate and the page cannot disagree. A connected site outranks a missing
 * Google grant: `connect` is `Optional` then.
 */
export function resolveOnboardingResumeStep(signals: OnboardingResumeSignals): OnboardingStep {
  const resolution = resolveOnboarding({
    steps: evaluateOnboardingSteps(FIRST_RUN_STEPS, { ...signals, connectBlocked: false }),
    requested: null,
  })
  return resolution._tag === 'Current' ? parseOnboardingStep(resolution.current.id) ?? 'sync' : 'sync'
}

/**
 * Where the OAuth callback sends a user when Google returns no usable grant:
 * the Search Console box was unticked, the reader cancelled, or the round trip
 * failed. `returnTo` is already parsed by `safeAuthRedirect`.
 *
 * A wizard return names `step=sites`, the step after a successful connect, so
 * it is rewritten to `connect`: that is the step that shows the error and the
 * retry. Any other page keeps its path and gains the error marker.
 */
export function gscCallbackErrorRedirect(returnTo: string | null | undefined, error: GscCallbackError): string {
  const url = new URL(returnTo || DASHBOARD_ROUTE, 'https://callback.local')
  if (isUnder(url.pathname, ONBOARDING_ROUTE))
    url.searchParams.set('step', 'connect')
  url.searchParams.set('error', error)
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Where Connect Google returns after a grant: the step after it. The chosen
 * agent rides along in `?agent=`, so Back from a later step reopens Agent
 * setup with the same choice. An error return keeps it too
 * (`gscCallbackErrorRedirect` rewrites only `step` and `error`).
 */
export function onboardingConnectReturnTo(agent: AgentSetupRoute | null): string {
  const query = new URLSearchParams({ step: 'sites' })
  if (agent)
    query.set('agent', agent)
  return `${ONBOARDING_ROUTE}?${query}`
}

export interface OnboardingGateInput extends OnboardingResumeSignals {
  path: string
  loggedIn: boolean
  onboardingCompletedAt: string | null | undefined
}

export type OnboardingGate
  = | { _tag: 'Allow' }
    | { _tag: 'Redirect', path: string, query?: { step: OnboardingStep } }

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/**
 * The whole gate, as one function of the current path and the session.
 *
 * The gate used to live in two dashboard layouts as a `watch` plus a
 * `router.push`, which fired after the page had already started rendering and
 * could not see `/account`. Deciding here means the redirect happens before the
 * page mounts and the exemptions are one list.
 */
export function resolveOnboardingGate(input: OnboardingGateInput): OnboardingGate {
  if (!isUnder(input.path, DASHBOARD_ROUTE))
    return { _tag: 'Allow' }

  // Signed out is the auth middleware's redirect, not this one's.
  if (!input.loggedIn)
    return { _tag: 'Allow' }

  const onWizard = isUnder(input.path, ONBOARDING_ROUTE)

  if (input.onboardingCompletedAt) {
    // A stale bookmark must not re-open first-run setup for a finished user.
    return onWizard ? { _tag: 'Redirect', path: DASHBOARD_ROUTE } : { _tag: 'Allow' }
  }

  if (ONBOARDING_EXEMPT_PREFIXES.some(prefix => isUnder(input.path, prefix)))
    return { _tag: 'Allow' }

  return {
    _tag: 'Redirect',
    path: ONBOARDING_ROUTE,
    query: { step: resolveOnboardingResumeStep(input) },
  }
}

export interface OnboardingCompletionInput {
  completedAt: Date | string | null | undefined
  /** The caller's current team owns at least one site. */
  hasSites: boolean
  /** The user chose "Skip and connect it later" on the sites step. */
  skipSites: boolean
  /**
   * The account's Google grant, as a fresh gscdump read found it. `Unknown`
   * when gscdump could not say: finishing with no Site closes setup for good,
   * so it waits for an answer.
   */
  googleGrant: 'Usable' | 'Unusable' | 'Unknown'
  now: Date
}

export type OnboardingCompletion
  = | { _tag: 'AlreadyComplete', completedAt: string }
    | { _tag: 'Blocked', reason: 'no_sites' | 'google_required' | 'google_unverified', message: string }
    | { _tag: 'Complete', completedAt: string, sites: 'connected' | 'skipped' }

/**
 * Whether the completion endpoint may stamp `users.onboarding_completed_at`.
 *
 * The flag closes the wizard for good. With no Site, the user must say so
 * with the skip. The dashboard then offers Connect a Site on
 * `CONNECT_SITE_ROUTE`, which works after onboarding. Without the skip,
 * finishing with no Site is refused, so a stray click on the last step does
 * not leave an empty dashboard. The skip needs Google connected: without
 * Google there is no property to connect, and a link to the sites step must
 * not finish setup the way the removed Connect Google skip did. A Team that
 * already has a Site finishes without its member's own grant.
 */
export function resolveOnboardingCompletion(input: OnboardingCompletionInput): OnboardingCompletion {
  if (input.completedAt) {
    const completedAt = input.completedAt instanceof Date
      ? input.completedAt.toISOString()
      : new Date(input.completedAt).toISOString()
    return { _tag: 'AlreadyComplete', completedAt }
  }

  if (!input.hasSites && !input.skipSites) {
    return {
      _tag: 'Blocked',
      reason: 'no_sites',
      message: 'Connect at least one Site before you finish setup.',
    }
  }

  if (!input.hasSites && input.googleGrant === 'Unknown') {
    return {
      _tag: 'Blocked',
      reason: 'google_unverified',
      message: 'Request Indexing could not check your Google connection. Try finishing setup again in a moment.',
    }
  }

  if (!input.hasSites && input.googleGrant !== 'Usable') {
    return {
      _tag: 'Blocked',
      reason: 'google_required',
      message: 'Connect Google Search Console before you finish setup.',
    }
  }

  return {
    _tag: 'Complete',
    completedAt: input.now.toISOString(),
    sites: input.hasSites ? 'connected' : 'skipped',
  }
}

/**
 * Read an untrusted "onboarding is already finished" flag once, at the
 * boundary. `0`, `false` and `no` mean the account has not finished
 * onboarding. Every other value, an absent one included, means it has.
 *
 * Only the dev sign-in route uses this today. It lives here because the flag
 * decides which side of the onboarding gate an account starts on.
 */
export function parseOnboardingCompletedFlag(value: unknown): boolean {
  if (typeof value !== 'string')
    return true
  return !['0', 'false', 'no'].includes(value.toLowerCase())
}
