// Canonical names for runtime failures we log but do not throw.
//
// Pattern at the call site:
//
//   import { log } from 'evlog'
//   .catch(err => log.warn({ name: 'agency_overage.meter_failed', error: err, ctx: { customerId } }))
//
// Adding a new failure mode = adding an entry here. Keep names as
// `<domain>.<thing>_<failureMode>` and stable — they end up indexed in
// whatever drain we ship (Sentry today, D1 next).
//
// Shared across server + client runtime graphs (see ADR-0022).

export const LOG_CATALOG = {
  // Pro lifecycle / events
  'pro_event.record_failed': 'proEvent insert failed during a "first X" milestone',
  'telemetry.insert_failed': 'pro telemetry event insert failed',

  // gscdump bridge
  'gscdump.unlink.remote_failed': 'gscdump.com API call failed during local unlink/reconcile',
  'gscdump.proxy.failed': 'gscdump.com upstream call from proxy failed',
  'gscdump.teams.client_failed': 'gscdump teams-client mutation failed',
  'gscdump.integration.probe_failed': 'pro gscdump-integration probe failed on the client plugin',
  'gscdump.engine.fallback': 'browser DuckDB-WASM path threw and fell back to cloud (paying user got slow path)',
  'gscdump.table_cell.unresolved': 'a table cell read (top association) failed; the cells degrade to a dash',
  'gscdump.registration.refused': 'gscdump refused a Site registration (Free allowance or duplicate property); the Site stays connected without Search Console',
  'gscdump.registration.unreadable': 'gscdump answered a registration with a Site this partner cannot read; the Site stays unlinked and the reconcile asks again',
  'gscdump.site_access.read_failed': 'a gscdump Site read failed while checking a stored link; the link stays until the next reconcile',

  // Storage / KV best-effort
  'kv.best_effort_write_failed': 'KV/storage write blip; counters/cache will self-heal',
  'kv.best_effort_read_failed': 'KV/storage read blip; treat as cache-miss',

  // Dashboard async data
  'dashboard.section_fetch_failed': 'lazy section query failed; section shows empty state',
  'dashboard.action_unhandled': 'pro-fetch mutation rejected with no _proHandled flag — bug surface',

  // Webhooks
  'webhook.side_effect_failed': 'post-success side effect inside an already-acknowledged webhook',
  'webhook.allowance_notice_unknown_user': 'a user.allowance.notice named a gscdump user with no local account; no email was sent',

  // Tasks
  'task.batch_item_failed': 'a single item in a cron-task batch raised',

  // Auth / probes
  'auth.optional_probe_failed': 'optional plugin/probe lookup failed (no provider, expired session)',
  'auth.email_lookup_failed': 'the provider email lookup failed, so sign-in could not confirm a verified email and refused',
  'auth.account_create_failed': 'account creation during sign-in threw; the user saw "Failed to create account"',
  'auth.session_refresh_failed': 'session refresh after STATE_CHANGED 409 failed',

  // Notifications
  'notification.insert_failed': 'notifications row insert failed inside a reconciliation pass',

  // Misc server
  'create_user.orphan_cleanup_failed': 'failed to clean up orphan user after team-insert failure',
  'create_user.identity_insert_failed': 'failed to write user_identities row alongside user create',

  // E2E
  'e2e.setup_failed': 'test-setup/teardown best-effort cleanup',

  // Background fetches (page render does not depend on the result)
  'background.fetch_failed': 'fire-and-forget client/page fetch failed; UI degrades gracefully',

  // MCP tool/server side effects
  'mcp.background_failed': 'MCP handler background side-effect failed',

  // Chat
  'chat.background_failed': 'pro-chat background side-effect failed',

  // Handler-internal best-effort branches
  'handler.body_parse_failed': 'readBody failed; treated as undefined and re-validated by zod',
  'handler.unhandled_error': 'unhandled throw inside a pro API handler; the client got a generic 500 envelope',

  // Transactional email (drip, invites, discord role assign, etc.)
  'email.send_failed': 'transactional email send failed; user does not see it but it should have shipped',

  // Google Indexing API

  // Account deletion
  'account.google_revoke_failed': 'Google did not revoke a stored token during account deletion; the token row is deleted, so the grant stays until the person removes it in their Google Account',

  // Free tools
  'dataforseo.domain_metrics_unavailable': 'the site report Labs traffic call failed; traffic and keywords show as unavailable, never zero',
} as const

export type LogName = keyof typeof LOG_CATALOG
