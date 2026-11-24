import { setCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'
import { definePlugin } from 'nitro'
import { getPlatformProxy } from 'wrangler'

export default definePlugin(async (app) => {
  const { cf, ctx, dispose, env } = await getPlatformProxy({ remoteBindings: false })
  setCloudflareBindings(env)

  app.hooks.hook('request', (event) => {
    event.context.cf = cf
    event.context.cloudflare = { env, context: ctx, request: event.req }
    event.context.waitUntil = ctx.waitUntil.bind(ctx)
  })

  app.hooks.hook('close', dispose)
})
