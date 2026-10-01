import type { H3Event } from 'h3'
import { runChecks } from '@harlan-zw/nuxt-checkin/server'
import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'
import checks from '#checkin/checks'
import { resolveCheckinDeployment } from './checkin-deployment'

export function runDailyCheckin(event: H3Event) {
  const config = useRuntimeConfig(event)
  const bindings = resolveCloudflareBindings<{ CF_VERSION_METADATA?: { id?: string, tag?: string } }>(event)
  // Preserve the event context so public Cloudflare checks read the existing bindings.
  const context = {
    context: event.context,
    onboardingDripEnabled: config.onboardingDripEnabled,
    notificationsEnabled: config.notificationsEnabled,
    gscdump: config.gscdump,
  }
  return runChecks(checks, {
    event: context,
    required: ['request-indexing.database', 'request-indexing.integration'],
    identity: { site: 'requestindexing.com', environment: 'production', deployment: resolveCheckinDeployment(bindings?.CF_VERSION_METADATA) },
    timeoutMs: 10_000,
    totalTimeoutMs: 15_000,
  })
}
