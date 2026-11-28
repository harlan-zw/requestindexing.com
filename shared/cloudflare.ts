// Secrets the Worker cannot boot without. Deploy fails fast when one is
// missing, which is the point: an empty secret used to be baked in as an empty
// `var` and only surfaced as a runtime 500.
//
// Stripe reconciliation is sandbox-only. Production deploys have no Stripe keys.
export const CLOUDFLARE_REQUIRED_SECRETS = [
  'NUXT_APP_SECRET',
  'NUXT_DATAFORSEO_LOGIN',
  'NUXT_DATAFORSEO_PASSWORD',
  'NUXT_GSCDUMP_API_KEY',
  'NUXT_GSCDUMP_WEBHOOK_SECRET',
  'NUXT_KEY',
  'NUXT_OAUTH_GOOGLE_CLIENT_SECRET',
  'NUXT_POSTMARK_API_KEY',
  'NUXT_SERVICE_SIGNING_SECRET',
]

// Secrets the deploy uploads only when they are set. The Worker boots without
// them, and the feature that reads one says it is not set up.
export const CLOUDFLARE_OPTIONAL_SECRETS = [
  'NUXT_GOOGLE_INDEXING_CLIENT_SECRET',
]
