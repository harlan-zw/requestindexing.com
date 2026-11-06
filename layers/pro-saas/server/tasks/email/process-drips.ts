import { sendEmail } from '~~/layers/core/server/utils/email'
import { useGscdumpClient } from '#layers/pro-gsc/server/utils/gscdump-client'
import { readOnboardingFollowUp } from '../../utils/onboarding-follow-up'
import { processDueDrips } from '../../utils/process-drips'

// Scheduled every 10 minutes in `nuxt.config.ts`, as on nuxtseo.com.
export default defineTask({
  meta: {
    name: 'email:process-drips',
    description: 'Send due onboarding drip emails',
  },
  async run() {
    const config = useRuntimeConfig()
    const db = useDrizzle()
    const now = new Date()
    const result = await processDueDrips({
      db,
      now,
      readProgress: userId => readOnboardingFollowUp({ db, now, readLifecycle: id => useGscdumpClient().getUserLifecycle(id), readTask: id => useStorage('cache').getItem(`onboarding:page:${id}`) }, userId),
      onboardingDripEnabled: config.onboardingDripEnabled,
      send: sendEmail,
      baseUrl: config.public.baseUrl,
      secret: config.session.password,
    })
    return { result }
  },
})
