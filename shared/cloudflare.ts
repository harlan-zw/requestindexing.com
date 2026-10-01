// Secrets the Worker cannot boot without. Deploy fails fast when one is
// missing, which is the point: an empty secret used to be baked in as an empty
// `var` and only surfaced as a runtime 500.
//
// Stripe is deliberately absent. Billing was removed for the free-only beta;
// there is no paid tier and no Stripe keys to require.
export const CLOUDFLARE_REQUIRED_SECRETS = [
  'NUXT_DATAFORSEO_LOGIN',
  'NUXT_DATAFORSEO_PASSWORD',
  'NUXT_GSCDUMP_API_KEY',
  'NUXT_GSCDUMP_WEBHOOK_SECRET',
  'NUXT_KEY',
  'NUXT_OAUTH_GOOGLE_CLIENT_SECRET',
  'NUXT_POSTMARK_API_KEY',
  'NUXT_SESSION_PASSWORD',
]

// Secrets the deploy uploads only when they are set. The Worker boots without
// them, and the feature that reads one says it is not set up.
export const CLOUDFLARE_OPTIONAL_SECRETS = [
  'NUXT_GOOGLE_INDEXING_CLIENT_SECRET',
]
