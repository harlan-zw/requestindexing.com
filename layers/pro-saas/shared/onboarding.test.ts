import type { GscConnection } from './onboarding'
import { describe, expect, it } from 'vitest'
import {
  canAdvanceOnboardingStep,
  canSkipOnboardingSites,
  gscScopeMissingRedirect,
  ONBOARDING_ROUTE,
  ONBOARDING_STEPS,
  onboardingStepIndex,
  parseOnboardingCompletedFlag,
  parseOnboardingStep,
  resolveGscConnection,
  resolveOnboardingCompletion,
  resolveOnboardingGate,
  resolveOnboardingNav,
  resolveOnboardingResumeStep,
} from './onboarding'

const CONNECTED: GscConnection = { _tag: 'Connected' }
const NOT_CONNECTED: GscConnection = { _tag: 'NotConnected' }
const SCOPE_MISSING: GscConnection = { _tag: 'ScopeMissing' }

describe('resolveGscConnection', () => {
  it('reads a gscdump credential as connected', () => {
    expect(resolveGscConnection({ gscdumpConnected: true, accountStatus: null, error: undefined })).toEqual(CONNECTED)
    expect(resolveGscConnection({ gscdumpConnected: false, accountStatus: null, error: undefined })).toEqual(NOT_CONNECTED)
  })

  it('lets a scope-missing callback outrank a stored credential', () => {
    // An account from an earlier grant keeps its gscdump key, but the grant
    // Google just returned has no Search Console scope.
    expect(resolveGscConnection({ gscdumpConnected: true, accountStatus: null, error: 'gsc_scope_missing' })).toEqual(SCOPE_MISSING)
    expect(resolveGscConnection({ gscdumpConnected: false, accountStatus: null, error: 'gsc_scope_missing' })).toEqual(SCOPE_MISSING)
  })

  it('reads gscdump\'s scope_missing as ScopeMissing for a returning user', () => {
    // No callback marker: the user signed in again days later. The key from the
    // earlier grant is still stored, but gscdump knows the grant is unusable.
    expect(resolveGscConnection({ gscdumpConnected: true, accountStatus: 'scope_missing', error: undefined })).toEqual(SCOPE_MISSING)
  })

  it.each(['ready', 'db_provisioning', 'reauth_required'] as const)('keeps a stored credential connected when gscdump reports %s', (accountStatus) => {
    expect(resolveGscConnection({ gscdumpConnected: true, accountStatus, error: undefined })).toEqual(CONNECTED)
  })

  it('ignores an unrelated error value', () => {
    expect(resolveGscConnection({ gscdumpConnected: true, accountStatus: null, error: 'google_auth_failed' })).toEqual(CONNECTED)
  })
})

describe('gscScopeMissingRedirect', () => {
  it('sends a wizard return back to the connect step', () => {
    expect(gscScopeMissingRedirect('/pro/dashboard/onboarding?step=sites'))
      .toBe('/pro/dashboard/onboarding?step=connect&error=gsc_scope_missing')
  })

  it('keeps any other return page and marks it', () => {
    expect(gscScopeMissingRedirect('/pro/dashboard/account'))
      .toBe('/pro/dashboard/account?error=gsc_scope_missing')
    expect(gscScopeMissingRedirect('/pro/dashboard/sites/s_1?tab=pages#top'))
      .toBe('/pro/dashboard/sites/s_1?tab=pages&error=gsc_scope_missing#top')
  })

  it('replaces an earlier error instead of stacking a second one', () => {
    expect(gscScopeMissingRedirect('/pro/dashboard?error=google_auth_failed'))
      .toBe('/pro/dashboard?error=gsc_scope_missing')
  })

  it('falls back to the dashboard when there is no return page', () => {
    expect(gscScopeMissingRedirect(undefined)).toBe('/pro/dashboard?error=gsc_scope_missing')
  })
})

describe('resolveOnboardingResumeStep', () => {
  it('starts at connect while nothing has been done', () => {
    expect(resolveOnboardingResumeStep({ gsc: NOT_CONNECTED, hasSites: false })).toBe('connect')
  })

  it('resumes at sites once Google is connected and no site exists', () => {
    expect(resolveOnboardingResumeStep({ gsc: CONNECTED, hasSites: false })).toBe('sites')
  })

  it('resumes at connect when Google returned no Search Console scope', () => {
    expect(resolveOnboardingResumeStep({ gsc: SCOPE_MISSING, hasSites: false })).toBe('connect')
  })

  it('resumes at sync once a site exists, connected to Google or not', () => {
    expect(resolveOnboardingResumeStep({ gsc: CONNECTED, hasSites: true })).toBe('sync')
    expect(resolveOnboardingResumeStep({ gsc: NOT_CONNECTED, hasSites: true })).toBe('sync')
  })
})

describe('canAdvanceOnboardingStep', () => {
  it('lets a user leave the connect step without a Google grant', () => {
    expect(canAdvanceOnboardingStep('connect', { gsc: NOT_CONNECTED, hasSites: false })).toBe(true)
  })

  it('holds the sites step until a site exists', () => {
    expect(canAdvanceOnboardingStep('sites', { gsc: CONNECTED, hasSites: false })).toBe(false)
    expect(canAdvanceOnboardingStep('sites', { gsc: NOT_CONNECTED, hasSites: true })).toBe(true)
  })

  it('lets the last step finish', () => {
    expect(canAdvanceOnboardingStep('sync', { gsc: NOT_CONNECTED, hasSites: true })).toBe(true)
  })
})

describe('canSkipOnboardingSites', () => {
  it('offers the skip once connecting is blocked and no site exists', () => {
    // A gscdump outage or a full Free allowance must not trap the user here.
    expect(canSkipOnboardingSites({ hasSites: false, connectBlocked: true })).toBe(true)
  })

  it('keeps the skip hidden until a connect attempt fails', () => {
    expect(canSkipOnboardingSites({ hasSites: false, connectBlocked: false })).toBe(false)
  })

  it('hides the skip once a site exists, because Continue works', () => {
    expect(canSkipOnboardingSites({ hasSites: true, connectBlocked: true })).toBe(false)
  })
})

describe('resolveOnboardingNav', () => {
  it('offers only the skip on the connect step before a grant', () => {
    // Connect drives the advance here, so a Continue beside it read as a
    // second Connect (UX replay A13).
    for (const gsc of [NOT_CONNECTED, SCOPE_MISSING])
      expect(resolveOnboardingNav('connect', gsc)).toEqual({ skipLabel: 'Skip for now', showNext: false })
  })

  it('offers only Continue on the connect step once Search Console is connected', () => {
    expect(resolveOnboardingNav('connect', CONNECTED)).toEqual({ skipLabel: undefined, showNext: true })
  })

  it('never renders the skip and the advance button side by side', () => {
    for (const step of ONBOARDING_STEPS) {
      for (const gsc of [CONNECTED, NOT_CONNECTED, SCOPE_MISSING]) {
        const nav = resolveOnboardingNav(step, gsc)
        expect([nav.skipLabel !== undefined, nav.showNext].filter(Boolean)).toHaveLength(1)
      }
    }
  })
})

describe('parseOnboardingStep', () => {
  it('accepts every declared step', () => {
    expect(parseOnboardingStep('connect')).toBe('connect')
    expect(parseOnboardingStep('sites')).toBe('sites')
    expect(parseOnboardingStep('sync')).toBe('sync')
  })

  it('rejects anything else', () => {
    expect(parseOnboardingStep('plan')).toBeNull()
    expect(parseOnboardingStep('')).toBeNull()
    expect(parseOnboardingStep(undefined)).toBeNull()
    expect(parseOnboardingStep(['sites'])).toBeNull()
  })
})

describe('onboardingStepIndex', () => {
  it('orders the steps as the progress rail renders them', () => {
    expect(onboardingStepIndex('connect')).toBe(0)
    expect(onboardingStepIndex('sites')).toBe(1)
    expect(onboardingStepIndex('sync')).toBe(2)
  })
})

describe('resolveOnboardingGate', () => {
  const onboarded = {
    loggedIn: true,
    onboardingCompletedAt: '2026-09-01T00:00:00.000Z',
    gsc: CONNECTED,
    hasSites: true,
  }
  const halfway = {
    loggedIn: true,
    onboardingCompletedAt: null,
    gsc: CONNECTED,
    hasSites: false,
  }

  it('ignores every path outside the dashboard', () => {
    expect(resolveOnboardingGate({ ...halfway, path: '/' })).toEqual({ _tag: 'Allow' })
    expect(resolveOnboardingGate({ ...halfway, path: '/login' })).toEqual({ _tag: 'Allow' })
    expect(resolveOnboardingGate({ ...halfway, path: '/auth/google' })).toEqual({ _tag: 'Allow' })
  })

  it('leaves a signed-out visitor to the auth middleware', () => {
    expect(resolveOnboardingGate({ ...halfway, loggedIn: false, path: '/pro/dashboard' })).toEqual({ _tag: 'Allow' })
  })

  it('sends a half-onboarded user to the step they are up to', () => {
    expect(resolveOnboardingGate({ ...halfway, path: '/pro/dashboard' })).toEqual({
      _tag: 'Redirect',
      path: ONBOARDING_ROUTE,
      query: { step: 'sites' },
    })
  })

  it('does not send a user who already has a site back to the Google step', () => {
    expect(resolveOnboardingGate({ ...halfway, gsc: NOT_CONNECTED, hasSites: true, path: '/pro/dashboard' })).toEqual({
      _tag: 'Redirect',
      path: ONBOARDING_ROUTE,
      query: { step: 'sync' },
    })
  })

  it('keeps the account pages reachable during onboarding', () => {
    expect(resolveOnboardingGate({ ...halfway, path: '/pro/dashboard/account' })).toEqual({ _tag: 'Allow' })
    expect(resolveOnboardingGate({ ...halfway, path: '/account/billing' })).toEqual({ _tag: 'Allow' })
  })

  it('never redirects the wizard onto itself', () => {
    expect(resolveOnboardingGate({ ...halfway, path: ONBOARDING_ROUTE })).toEqual({ _tag: 'Allow' })
  })

  it('takes a finished user off the wizard', () => {
    expect(resolveOnboardingGate({ ...onboarded, path: ONBOARDING_ROUTE })).toEqual({
      _tag: 'Redirect',
      path: '/pro/dashboard',
    })
  })

  it('leaves a finished user alone everywhere else', () => {
    expect(resolveOnboardingGate({ ...onboarded, path: '/pro/dashboard/sites/s_abc/indexing' })).toEqual({ _tag: 'Allow' })
  })
})

describe('resolveOnboardingCompletion', () => {
  const now = new Date('2026-09-15T10:00:00.000Z')

  it('refuses to finish onboarding with no site and no skip', () => {
    expect(resolveOnboardingCompletion({ completedAt: null, hasSites: false, skipSites: false, now })).toEqual({
      _tag: 'Blocked',
      reason: 'no_sites',
      message: 'Connect at least one Site before you finish setup.',
    })
  })

  it('stamps the clock when a site is connected', () => {
    expect(resolveOnboardingCompletion({ completedAt: null, hasSites: true, skipSites: false, now })).toEqual({
      _tag: 'Complete',
      completedAt: '2026-09-15T10:00:00.000Z',
      sites: 'connected',
    })
  })

  it('finishes with no site when the user skipped the sites step', () => {
    expect(resolveOnboardingCompletion({ completedAt: null, hasSites: false, skipSites: true, now })).toEqual({
      _tag: 'Complete',
      completedAt: '2026-09-15T10:00:00.000Z',
      sites: 'skipped',
    })
  })

  it('counts a site that landed before the skip as connected', () => {
    // The connect request can succeed after the form showed a failure.
    expect(resolveOnboardingCompletion({ completedAt: null, hasSites: true, skipSites: true, now })).toEqual({
      _tag: 'Complete',
      completedAt: '2026-09-15T10:00:00.000Z',
      sites: 'connected',
    })
  })

  it('is idempotent for a user who already finished', () => {
    expect(resolveOnboardingCompletion({
      completedAt: new Date('2026-09-01T00:00:00.000Z'),
      hasSites: false,
      skipSites: false,
      now,
    })).toEqual({
      _tag: 'AlreadyComplete',
      completedAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

describe('parseOnboardingCompletedFlag', () => {
  it('treats an absent or non-string flag as finished onboarding', () => {
    expect(parseOnboardingCompletedFlag(undefined)).toBe(true)
    expect(parseOnboardingCompletedFlag(null)).toBe(true)
    expect(parseOnboardingCompletedFlag(['0'])).toBe(true)
  })

  it('reads the opt-out spellings as unfinished onboarding', () => {
    expect(parseOnboardingCompletedFlag('0')).toBe(false)
    expect(parseOnboardingCompletedFlag('false')).toBe(false)
    expect(parseOnboardingCompletedFlag('No')).toBe(false)
  })

  it('keeps every other value on the finished side', () => {
    expect(parseOnboardingCompletedFlag('1')).toBe(true)
    expect(parseOnboardingCompletedFlag('')).toBe(true)
    expect(parseOnboardingCompletedFlag('yes')).toBe(true)
  })
})
