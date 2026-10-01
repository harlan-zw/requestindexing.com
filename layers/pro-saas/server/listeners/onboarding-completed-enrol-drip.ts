import type { EventPayload } from '#domain-events/server'
import { defineListener } from '@harlan-zw/nuxt-domain-events/server'
import { enrolOnboardingDrip } from '../utils/drip-sequences'

// Ported from nuxtseo.com's `onboarding-completed-queue-drip`. A failure is
// isolated and logged by the observer, so it never fails onboarding itself.
export default defineListener({
  name: 'saas.onboarding-completed-enrol-drip',
  event: 'pro:onboarding:completed',
  execution: { _tag: 'sync', failure: 'isolate' },
  handle: async ({ event, userId }: EventPayload<'pro:onboarding:completed'>) => {
    await enrolOnboardingDrip({
      db: useDrizzle(event),
      onboardingDripEnabled: useRuntimeConfig(event).onboardingDripEnabled,
      now: new Date(),
    }, userId)
  },
})
