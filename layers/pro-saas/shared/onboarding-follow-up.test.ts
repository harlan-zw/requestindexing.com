import { expect, it } from 'vitest'
import { resolveOnboardingGate } from './onboarding'
import { onboardingFollowUpReady } from './onboarding-follow-up'
import { PAGE_TASK_ROUTE } from './page-task'

it('keeps the existing welcome but waits for missing prerequisites before later material', () => {
  expect(onboardingFollowUpReady(0, 'google-missing')).toBe(true)
  expect(onboardingFollowUpReady(1, 'google-missing')).toBe(false)
  expect(onboardingFollowUpReady(1, 'site-missing')).toBe(false)
  expect(onboardingFollowUpReady(2, 'evidence-missing')).toBe(false)
  expect(onboardingFollowUpReady(2, 'ready')).toBe(true)
  expect(onboardingFollowUpReady(0, 'unavailable')).toBe(false)
})

it.each([null, '2026-11-07T00:00:00Z'])('lets a user read their page result before or after setup completion', (onboardingCompletedAt) => {
  expect(resolveOnboardingGate({ path: PAGE_TASK_ROUTE, loggedIn: true, onboardingCompletedAt, gsc: { _tag: 'Connected' }, hasSites: true })).toEqual({ _tag: 'Allow' })
})
