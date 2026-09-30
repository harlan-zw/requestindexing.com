// The onboarding decision layer. Pure data in, pure data out, so the route
// middleware, the wizard page and the completion endpoint all read one rule set
// instead of three copies that drift.
//
// The flow is nuxtseo.com's URL-driven wizard cut to what this product does:
// Google Search Console is the only integration, there is no billing and there
// are no invites, so `help`, `plan` and `invite` are gone and `integrations`
// folds into `connect`.

import type { AccountStatus } from '@gscdump/contracts'
import { GSC_SCOPE_MISSING_ERROR, isGscScopeMissingError } from '#layers/pro-gsc/shared/gsc-grant'

/** Where a signed-out visitor starts. Renders the provider buttons. */
export const ONBOARDING_ENTRY_ROUTE = '/pro/onboarding'

/**
 * The wizard. It sits under `/pro/dashboard` so one auth gate covers it, and
 * the onboarding gate exempts it so it can never redirect onto itself.
 */
export const ONBOARDING_ROUTE = '/pro/dashboard/onboarding'

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
  '/pro/dashboard/account',
  '/account',
  ONBOARDING_ROUTE,
] as const

export const ONBOARDING_STEPS = ['connect', 'sites', 'sync'] as const

export type OnboardingStep = typeof ONBOARDING_STEPS[number]

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  connect: 'Connect Google',
  sites: 'Connect sites',
  sync: 'Start syncing',
}

/** Parse an untrusted `?step=` value once, at the boundary. */
export function parseOnboardingStep(value: unknown): OnboardingStep | null {
  if (typeof value !== 'string')
    return null
  return (ONBOARDING_STEPS as readonly string[]).includes(value) ? value as OnboardingStep : null
}

export function onboardingStepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step)
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
 * Only `scope_missing` maps here. `reauth_required` and `refresh_missing` need
 * a reconnect too, but the ScopeMissing alert tells the user to tick a box,
 * which is the wrong instruction for them.
 */
export function resolveGscConnection(input: GscConnectionInput): GscConnection {
  if (isGscScopeMissingError(input.error) || input.accountStatus === 'scope_missing')
    return { _tag: 'ScopeMissing' }
  return input.gscdumpConnected ? { _tag: 'Connected' } : { _tag: 'NotConnected' }
}

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
 * A connected site outranks a missing Google grant. `connect` is an offer, not
 * a requirement, so a user who already registered a site must never be sent
 * back to it: that is the state they land in when Google is unreachable, and
 * they would resume onto the one step they cannot finish.
 */
export function resolveOnboardingResumeStep(signals: OnboardingResumeSignals): OnboardingStep {
  if (signals.hasSites)
    return 'sync'
  return signals.gsc._tag === 'Connected' ? 'sites' : 'connect'
}

/**
 * Whether the wizard may leave `step`.
 *
 * Registering a site is the only requirement. Connecting Search Console is a
 * capability the product offers, not a stage that gates it: a user who has not
 * verified a property, who signed in with GitHub, or whose grant fails cannot
 * satisfy it on demand, and gating on it left them on step one with a disabled
 * Continue and no way forward. This mirrors nuxtseo.com ADR-0035.
 */
export function canAdvanceOnboardingStep(step: OnboardingStep, signals: OnboardingResumeSignals): boolean {
  return step === 'sites' ? signals.hasSites : true
}

export interface SitesSkipInput {
  hasSites: boolean
  /**
   * A connect attempt failed on this step, or the Free allowance is full so
   * no attempt can start.
   */
  connectBlocked: boolean
}

/**
 * Whether the sites step offers "Skip and connect it later".
 *
 * nuxtseo.com's rule: the step needs a Site, but a Site that cannot connect
 * must never trap the user. A gscdump outage or a full Free allowance would.
 * The skip shows only after connecting is blocked, so it never reads as the
 * first choice.
 */
export function canSkipOnboardingSites(input: SitesSkipInput): boolean {
  return !input.hasSites && input.connectBlocked
}

/**
 * Where the OAuth callback sends a user whose grant has no Search Console
 * scope. `returnTo` is already parsed by `safeAuthRedirect`.
 *
 * A wizard return names `step=sites`, the step after a successful connect, so
 * it is rewritten to `connect`: that is the step that shows the error and the
 * retry. Any other page keeps its path and gains the error marker.
 */
export function gscScopeMissingRedirect(returnTo: string | null | undefined): string {
  const url = new URL(returnTo || DASHBOARD_ROUTE, 'https://callback.local')
  if (isUnder(url.pathname, ONBOARDING_ROUTE))
    url.searchParams.set('step', 'connect')
  url.searchParams.set('error', GSC_SCOPE_MISSING_ERROR)
  return `${url.pathname}${url.search}${url.hash}`
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
  now: Date
}

export type OnboardingCompletion
  = | { _tag: 'AlreadyComplete', completedAt: string }
    | { _tag: 'Blocked', reason: 'no_sites', message: string }
    | { _tag: 'Complete', completedAt: string, sites: 'connected' | 'skipped' }

/**
 * Whether the completion endpoint may stamp `users.onboarding_completed_at`.
 *
 * The flag closes the wizard for good. With no Site, the user must say so
 * with the skip. The dashboard then offers Connect a Site on
 * `CONNECT_SITE_ROUTE`, which works after onboarding. Without the skip,
 * finishing with no Site is refused, so a stray click on the last step does
 * not leave an empty dashboard.
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
      message: 'Connect at least one site before you finish setup.',
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
