import { defineEvent } from '@harlan-zw/nuxt-domain-events/server'
import { z } from 'zod'
import { idSchema, requestEventSchema } from './_schemas'

// A user finished first-run setup. Fired once per user, when
// `users.onboarding_completed_at` is first stamped. Named as on nuxtseo.com.
export default defineEvent({
  name: 'pro:onboarding:completed',
  transport: { _tag: 'local' },
  input: z.object({
    event: requestEventSchema,
    userId: idSchema,
    teamId: idSchema,
  }),
})
