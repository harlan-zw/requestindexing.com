import { sendEmail } from '~~/layers/core/server/utils/email'
import { processDueDrips } from '../../utils/process-drips'

// Scheduled every 10 minutes in `nuxt.config.ts`, as on nuxtseo.com.
export default defineTask({
  meta: {
    name: 'email:process-drips',
    description: 'Send due onboarding drip emails',
  },
  async run() {
    const config = useRuntimeConfig()
    const result = await processDueDrips({
      db: useDrizzle(),
      now: new Date(),
      onboardingDripEnabled: config.onboardingDripEnabled,
      send: sendEmail,
      baseUrl: config.public.baseUrl,
      secret: config.session.password,
    })
    return { result }
  },
})
