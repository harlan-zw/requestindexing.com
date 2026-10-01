import { defineEvent } from '@harlan-zw/nuxt-domain-events/server'
import { z } from 'zod'
import { idSchema, requestEventSchema, siteIdSchema } from './_schemas'

export default defineEvent({
  name: 'pro:site:added',
  transport: { _tag: 'local' },
  input: z.object({
    event: requestEventSchema,
    siteId: siteIdSchema,
    teamId: idSchema,
    url: z.string().min(1),
    userId: idSchema,
    isNew: z.boolean(),
    /**
     * The verified Search Console property the connect route matched to the
     * address. The listener links this one, so it never reads Google twice
     * and never picks a different property.
     */
    gscProperty: z.object({
      siteUrl: z.string().min(1),
      permissionLevel: z.string(),
      registered: z.boolean(),
      siteId: z.string().optional(),
    }).optional(),
  }),
})
