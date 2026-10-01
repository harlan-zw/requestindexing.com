/**
 * Pro-SaaS layer schema seam.
 *
 * Re-exports the host's drizzle schema (now lifted into
 * `layers/core/server/db/schema.ts`). The pro-saas layer imports its tables
 * from here; never from `~~/layers/core/...` directly.
 *
 * Identity ripples (text-UUID → integer PK) are resolved in pro-saas-auth
 * Phase B (see `.plans/02-pro-saas-auth.md`). This file just plumbs the names.
 */

export {
  adminEvents,
  dripEmails,
  failedJobs,
  feedback,
  googleAccounts,
  googleOAuthClients,
  indexingInvestigations,
  jobBatches,
  jobs,
  notificationOptouts,
  notifications,
  proEvents,
  runtimeErrors,
  sessions,
  siteGroups,
  sites,
  teamAuditEvents,
  teamGscCredentials,
  teamInvitations,
  teamMemberships,
  teams,
  teamSites,
  teamUser,
  telemetryEvents,
  userIdentities,
  users,
  userSites,
} from '~~/layers/core/server/db/schema'

export type {
  AdminEvent,
  AuthProviderId,
  Feedback,
  GoogleAccountsSelect,
  GoogleOAuthClientsSelect,
  IndexingInvestigation,
  NewAdminEvent,
  NewFeedback,
  NewIndexingInvestigation,
  NewNotification,
  NewProEvent,
  NewRuntimeError,
  NewSiteGroup,
  NewTeamAuditEvent,
  NewTeamGscCredential,
  NewTelemetryEvent,
  NewUser,
  NewUserIdentity,
  Notification,
  ProEvent,
  RuntimeError,
  Site,
  SiteGroup,
  Team,
  TeamAuditEvent,
  TeamAuditEventKind,
  TeamGscCredential,
  TeamGscCredentialStatus,
  TeamInvitation,
  TeamMembership,
  TeamRole,
  TelemetryEvent,
  User,
  UserIdentity,
} from '~~/layers/core/server/db/schema'
