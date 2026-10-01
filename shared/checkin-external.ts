import type { ExternalOptions } from '@harlan-zw/nuxt-checkin/external'

export const externalCheckin = {
  identity: { site: 'requestindexing.com', environment: 'production', deploymentEnv: 'CHECKIN_DEPLOYMENT' },
  required: ['request-indexing.report', 'request-indexing.sentry'],
  credentials: { sentry: 'SENTRY_AUTH_TOKEN' },
  save: {
    dir: 'docs/ops/checkins',
    dirEnv: 'DAILY_CHECKIN_DIR',
    stateFile: 'state.json',
    timestampKey: 'lastRunAt',
    baseline: 'daily',
    defaultWindowMs: 86_400_000,
  },
  prompts: [
    {
      id: 'site.collection-setup',
      prompt: `Before collection, load private credentials from $HOME/.config/harlan-checkin/requestindexing.com.env.
Never print or commit tokens.
Configure \`CHECKIN_DEPLOYMENT\`, \`SENTRY_ORG=harlan-zw\`, and \`SENTRY_AUTH_TOKEN\` externally.
The token authorizes only the read-only report. Keep existing admin authentication for admin operations.
Match \`CHECKIN_DEPLOYMENT\` to active Worker version metadata, not the latest CI commit.`,
    },
    {
      id: 'site.operations',
      prompt: `Check the existing admin jobs and OAuth endpoints when a result needs details.
Review gscdump connectivity and webhook evidence before attributing indexing failures to this site.
Never turn on NUXT_NOTIFICATIONS_ENABLED during check-in. It releases the onboarding drip emails and the bulk sync. Preserve the current runtime gate.
An intentional pause is reported as evidence, not an outage. The Free allowance email is never paused.
No system-health email exists. Do not create one or send test messages.

Keep the daily schedule at 06:00 Australia/Sydney. Do not create a separate Sentry schedule.`,
    },
  ],
  timeoutMs: 65000,
  totalTimeoutMs: 70000,
} satisfies ExternalOptions
