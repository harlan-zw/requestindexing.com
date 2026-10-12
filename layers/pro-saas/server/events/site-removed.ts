import { defineEvent } from '@harlan-zw/nuxt-domain-events/server'
import { z } from 'zod'
import { idSchema, requestEventSchema, siteIdSchema } from './_schemas'

export default defineEvent({
  name: 'pro:site:removed',
  transport: { _tag: 'local' },
  input: z.object({
    event: requestEventSchema,
    siteId: siteIdSchema,
    teamId: idSchema,
    userId: idSchema,
    gscdumpSiteId: z.string().nullable(),
    siteUrl: z.string(),
  }),
})
