import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { RequiredNonNullable } from '~~/layers/core/app/types/util'
import type { GoogleOAuthUser } from '~~/layers/core/server/app/utils/auth'
import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { customAlphabet } from 'nanoid'
// TODO(v1): google-auth-library not directly installed; using inline minimal types.
interface TokenInfo { scopes?: string[], expiry_date?: number }
interface CredentialRequest { refresh_token?: string, access_token?: string, expiry_date?: number, scope?: string, token_type?: string, id_token?: string }

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const length = 12

const nanoid = customAlphabet(alphabet, length)

// Short, copy-pastable public Site id used purely as the URL identity
// (`s_rkfg95k7`). `sites.id` stays the canonical UUID every foreign key points
// at; `publicId` only resolves the route param. Mirrors nuxtseo.com.
const sitePublicId = customAlphabet(alphabet, 8)

const timestamps = {
  createdAt: integer('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: integer('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}

export const teams = sqliteTable('teams', {
  teamId: integer('team_id').notNull().primaryKey(),
  publicId: text('public_id').notNull().$defaultFn(nanoid),
  personalTeam: integer('personal_team', { mode: 'boolean' }).notNull().default(true),
  name: text('name').notNull(),
  backupsEnabled: integer('backups_enabled').notNull().default(0),
  // pro-saas augment: explicit owner (nullable until backfilled to personal-team creator)
  // Mutual team and user foreign keys require one lazy forward reference.
  // eslint-disable-next-line ts/no-use-before-define
  ownerId: integer('owner_id').references((): AnySQLiteColumn => users.userId, { onDelete: 'cascade' }),
  // gscdump partner team mirror id
  gscdumpTeamId: text('gscdump_team_id'),
  ...timestamps,
})

export const users = sqliteTable('users', {
  userId: integer('user_id').notNull().primaryKey(),
  publicId: text('public_id').notNull().$defaultFn(nanoid),

  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatar: text('avatar').notNull(),

  // authPayload: text('auth_payload', { mode: 'json' }),
  lastLogin: integer('last_login').notNull(),
  sub: text('sub').notNull().unique(),
  // loginTokens: text('login_tokens', { mode: 'json' }).notNull().$type<Credentials>(),

  analyticsRange: text('analytics_range', { mode: 'json' }),
  analyticsPeriod: text('analytics_period'),

  // indexingTokens: text('indexing_tokens', { mode: 'json' }),
  // indexingOAuthId: text('indexing_oauth_id'),
  lastIndexingOAuthId: text('last_indexing_oauth_id'),

  // NOT NULL to match the live database, which migration 0000 created that way.
  // This was previously declared nullable, and drizzle's snapshot recorded it as
  // nullable too, so `drizzle-kit generate` saw no diff and never emitted a fix.
  // The mismatch was invisible until every signup failed: user rows were being
  // inserted before their personal team existed. Declaring it here makes the
  // type system reject that ordering instead of production doing it.
  currentTeamId: integer('current_team_id').notNull().references((): AnySQLiteColumn => teams.teamId),

  // gscdump partner integration
  gscdumpUserId: text('gscdump_user_id'),
  gscdumpApiKey: text('gscdump_api_key'),

  // Agent-native auth: per-user API key for MCP/CLI/webhook hosts.
  // Nullable for additive migration; backfilled via nanoid in 0004 then enforced.

  // Sign-up source for funnel attribution
  source: text('source'),
  // Onboarding completion is user-scoped, matching nuxtseo.com. It used to sit
  // on `teams.onboarded_step`, which made a second team look unonboarded.
  onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp' }),

  ...timestamps,
})

export const googleOAuthClients = sqliteTable('google_oauth_clients', {
  googleOAuthClientId: integer('google_oauth_client_id').notNull().primaryKey(),
  label: text('label').notNull(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  reserved: integer('reserved', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
}, t => ({
  unq: unique().on(t.clientId),
}))

export type GoogleOAuthClientsSelect = typeof googleOAuthClients.$inferSelect

// a user can have multiple google accounts linked to themselves
// we use a seperate oauth for indexing so a user could have 2 here so we need a type column
export const googleAccounts = sqliteTable('google_accounts', {
  googleAccountId: integer('google_account_id').notNull().primaryKey(),
  userId: integer('user_id').notNull().references(() => users.userId),
  type: text('type').notNull(), // auth, indexing
  payload: text('payload', { mode: 'json' }).notNull().$type<GoogleOAuthUser>(),
  tokenInfo: text('token_info', { mode: 'json' }).$type<TokenInfo>(),
  tokens: text('tokens', { mode: 'json' }).notNull().$type<RequiredNonNullable<CredentialRequest>>(),
  googleOAuthClientId: integer('google_oauth_client_id').notNull().references(() => googleOAuthClients.googleOAuthClientId),
  ...timestamps,
})

export type GoogleAccountsSelect = typeof googleAccounts.$inferSelect

export const sessions = sqliteTable('sessions', {
  sessionId: integer('session_id').notNull().primaryKey(),
  userId: integer('user_id').notNull().references(() => users.userId),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  payload: text('payload', { mode: 'json' }),
  lastActivity: integer('last_activity'),
}, t => ({
  unq: unique().on(t.userId, t.ipAddress, t.userAgent), // avoid duplicate sessions for same device
}))

export type TeamSelect = typeof teams.$inferSelect

export interface StoredSitemap {
  path?: string
  errors?: number | string
  warnings?: number | string
  [key: string]: unknown
}

export const teamUser = sqliteTable('team_user', {
  teamId: integer('team_id').notNull().references(() => teams.teamId),
  userId: integer('user_id').notNull().references(() => users.userId),
  role: text('role'),

  ...timestamps,
}, t => ({
  unq: unique().on(t.teamId, t.userId),
}))

export const teamUserInvite = sqliteTable('team_user_invite', {
  // invite is token based not email
  inviteId: text('invite_id').notNull().primaryKey(),
  teamId: integer('team_id').notNull(),
  email: text('email').notNull(),
  role: text('role'),
  ...timestamps,
})

export type UserSelect = typeof users.$inferSelect

export const sites = sqliteTable('sites', {
  // Canonical id. A text UUID, matching nuxtseo.com, so its server code and
  // query keys transfer without an id-shape rewrite at every boundary.
  id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  // URL-only identity (`s_` + nanoid). Resolved to `id` at the request
  // boundary by `requireSiteAccess`.
  publicId: text('public_id').notNull().$defaultFn(() => `s_${sitePublicId()}`),
  // Team is the single ownership and scoping axis. `ownerId` below is creator
  // attribution only, so removing the creator never orphans the team's site.
  teamId: integer('team_id').notNull().references(() => teams.teamId, { onDelete: 'restrict' }),
  property: text('property').notNull(),
  // hides domain properties which we've split into multiple sites
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  sitemaps: text('sitemaps', { mode: 'json' }).$type<StoredSitemap[]>(),

  // for split domain properties
  domain: text('domain'),
  parentId: text('parent_id').references((): AnySQLiteColumn => sites.id),

  // TODO better renaming for these two
  lastSynced: integer('last_synced'),
  isSynced: integer('is_synced', { mode: 'boolean' }).default(false),
  ownerId: integer('owner_id').references((): AnySQLiteColumn => users.userId),

  // gscdump partner integration
  gscdumpSiteId: text('gscdump_site_id'),
  gscdumpSiteUrl: text('gscdump_site_url'),
  gscdumpSyncStatus: text('gscdump_sync_status').$type<'pending' | 'syncing' | 'synced' | 'error'>(),

  ...timestamps,
}, t => ({
  // Team scoped, not global. `domain` used to carry a global unique index, so
  // the second team to connect any address hit a raw D1 constraint error and
  // onboarding died with a 500. Ownership is the team (see `teamId` above), and
  // nuxtseo.com scopes every `sites` uniqueness the same way.
  unqTeamDomain: unique('sites_team_id_domain_unique').on(t.teamId, t.domain),
  unqPublicId: unique().on(t.publicId),
  teamIdx: index('sites_team_idx').on(t.teamId),
}))

export type SiteInsert = typeof sites.$inferInsert
export type SiteSelect = typeof sites.$inferSelect

// TODO siteUsages (need to figure out billing but more granular is better)
export const usages = sqliteTable('usages', {
  siteId: text('site_id').notNull().references(() => sites.id),
  date: text('date').notNull(),
  key: text('key').notNull(),
  usage: integer('usage').notNull().default(0),
}, (t) => {
  return {
    unq: unique().on(t.siteId, t.date, t.key),
  }
})

// allow users to hide sites within a team dashboard, also track their permission level to a site
export const userSites = sqliteTable('user_sites', {
  userId: integer('user_id').notNull().references(() => users.userId),
  siteId: text('site_id').notNull().references(() => sites.id),
  permissionLevel: text('permission_level'),
}, t => ({
  unq: unique().on(t.userId, t.siteId),
}))

export type UserSitesSelect = typeof userSites.$inferSelect
export type UserSitesInsert = typeof userSites.$inferInsert

// multiple users and access a single site
export const teamSites = sqliteTable('team_sites', {
  teamId: integer('team_id').notNull().references(() => teams.teamId),
  siteId: text('site_id').notNull().references(() => sites.id),
  // someone on the team must have the permissions
  googleAccountId: integer('google_account_id').notNull().references(() => googleAccounts.googleAccountId),
  // site can be linked to a team but may not be enabled due to
  // free tier can only have 6 active, need to manually be enabled
  // active: integer('active', { mode: 'boolean' }).notNull().default(false),
}, t => ({
  unq: unique().on(t.teamId, t.siteId),
  googleAccountIdIdx: index('google_account_id_idx').on(t.googleAccountId),
}))

export type TeamSitesSelect = typeof teamSites.$inferSelect
export type TeamSitesInsert = typeof teamSites.$inferInsert

export const jobBatches = sqliteTable('job_batches', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  parentBatchId: text('parent_batch_id'),
  totalJobs: integer('total_jobs').notNull().default(0),
  pendingJobs: integer('pending_jobs').notNull().default(0),
  failedJobs: integer('failed_jobs').notNull().default(0),
  onFinish: text('on_finish'), // JSON: { name, payload }
  allowFailures: integer('allow_failures').default(0),
  siteId: text('site_id'),
  userId: integer('user_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  finishedAt: integer('finished_at'),
})

export type JobBatchInsert = typeof jobBatches.$inferInsert
export type JobBatchSelect = typeof jobBatches.$inferSelect

export const jobs = sqliteTable('jobs', {
  id: text('id').notNull().primaryKey(),
  queue: text('queue').notNull(),
  jobType: text('job_type').notNull(),
  batchId: text('batch_id'),
  userId: integer('user_id'),
  siteId: text('site_id'),
  payload: text('payload').notNull(), // JSON string with _task embedded
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  reservedAt: integer('reserved_at'),
  availableAt: integer('available_at').notNull(),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  failedAt: integer('failed_at'),
  lastError: text('last_error'),
  durationMs: integer('duration_ms'),
}, t => ({
  queueIdx: index('queue_idx').on(t.queue),
  batchIdx: index('batch_idx').on(t.batchId),
}))

export type JobInsert = typeof jobs.$inferInsert
export type JobSelect = typeof jobs.$inferSelect

export const failedJobs = sqliteTable('failed_jobs', {
  id: text('id').notNull().primaryKey(),
  queue: text('queue').notNull(),
  jobType: text('job_type').notNull(),
  batchId: text('batch_id'),
  userId: integer('user_id'),
  siteId: text('site_id'),
  payload: text('payload').notNull(),
  exception: text('exception').notNull(),
  attempts: integer('attempts').notNull(),
  maxAttempts: integer('max_attempts').notNull(),
  failedAt: integer('failed_at').notNull(),
})

export const googleOAuthClientsRelations = relations(googleOAuthClients, ({ many }) => ({
  googleAccounts: many(googleAccounts),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.userId],
  }),
}))

export const sitesRelations = relations(sites, ({ one, many }) => ({
  team: one(teams, {
    fields: [sites.teamId],
    references: [teams.teamId],
  }),
  userSites: many(userSites, { relationName: 'sites_users' }),
  teamSites: many(teamSites),
  owner: one(users, {
    fields: [sites.ownerId],
    references: [users.userId],
  }),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, {
    fields: [users.currentTeamId],
    references: [teams.teamId],
  }),
  sessions: many(sessions),
  userSites: many(userSites),
  googleAccounts: many(googleAccounts),
}))

export const googleAccountsRelations = relations(googleAccounts, ({ one }) => ({
  user: one(users, {
    fields: [googleAccounts.userId],
    references: [users.userId],
  }),
  googleOAuthClient: one(googleOAuthClients, {
    fields: [googleAccounts.googleOAuthClientId],
    references: [googleOAuthClients.googleOAuthClientId],
  }),
}))

export const teamUserRelations = relations(teamUser, ({ one }) => ({
  team: one(teams, {
    fields: [teamUser.teamId],
    references: [teams.teamId],
  }),
  user: one(users, {
    fields: [teamUser.userId],
    references: [users.userId],
  }),
}))

export const userSitesRelations = relations(userSites, ({ one, many }) => ({
  user: one(users, {
    fields: [userSites.userId],
    references: [users.userId],
  }),
  site: one(sites, {
    fields: [userSites.siteId],
    references: [sites.id],
    relationName: 'sites_users',
  }),
  sites: many(sites),
}))

export const teamSitesRelations = relations(teamSites, ({ one }) => ({
  team: one(teams, {
    fields: [teamSites.teamId],
    references: [teams.teamId],
  }),
  site: one(sites, {
    fields: [teamSites.siteId],
    references: [sites.id],
  }),
  googleAccount: one(googleAccounts, {
    fields: [teamSites.googleAccountId],
    references: [googleAccounts.googleAccountId],
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Pro-SaaS layer tables (adapted from layers/pro-saas; integer FKs to users/teams)
// ─────────────────────────────────────────────────────────────────────────────

export type AuthProviderId = 'github' | 'google'

// Sign-in identities. One row per (user, provider).
export const userIdentities = sqliteTable('user_identities', {
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  provider: text('provider').$type<AuthProviderId>().notNull(),
  providerUserId: text('provider_user_id').notNull(),
  email: text('email'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  linkedAt: integer('linked_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  pk: unique('user_identities_pk').on(t.provider, t.providerUserId),
  userProviderUnq: unique('user_identities_user_provider_unique').on(t.userId, t.provider),
  emailIdx: index('user_identities_email_idx').on(t.email),
  userIdx: index('user_identities_user_idx').on(t.userId),
}))

export type UserIdentity = typeof userIdentities.$inferSelect
export type NewUserIdentity = typeof userIdentities.$inferInsert

export type TeamRole = 'admin' | 'editor' | 'viewer'

// Non-owner team members. Owner has no row here (FK on teams.ownerId).
export const teamMemberships = sqliteTable('team_memberships', {
  teamMembershipId: integer('team_membership_id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id').notNull().references(() => teams.teamId, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).$type<TeamRole>().notNull(),
  firstVisitDismissedAt: integer('first_visit_dismissed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  teamUserUnq: unique('team_memberships_team_user_unique').on(t.teamId, t.userId),
}))

export const teamInvitations = sqliteTable('team_invitations', {
  teamInvitationId: integer('team_invitation_id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().$defaultFn(nanoid),
  teamId: integer('team_id').notNull().references(() => teams.teamId, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).$type<TeamRole>().notNull(),
  invitedById: integer('invited_by_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  teamEmailUnq: unique('team_invitations_team_email_unique').on(t.teamId, t.email),
}))

export type TeamAuditEventKind
  = | 'team.renamed'
    | 'team.transferred'
    | 'invitation.sent'
    | 'invitation.revoked'
    | 'invitation.accepted'
    | 'member.role_changed'
    | 'member.removed'
    | 'member.left'

export const teamAuditEvents = sqliteTable('team_audit_events', {
  teamAuditEventId: integer('team_audit_event_id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id').notNull().references(() => teams.teamId, { onDelete: 'cascade' }),
  actorUserId: integer('actor_user_id').references(() => users.userId, { onDelete: 'set null' }),
  kind: text('kind').$type<TeamAuditEventKind>().notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  teamCreatedIdx: index('team_audit_events_team_created_idx').on(t.teamId, t.createdAt),
}))

export type TeamGscCredentialStatus = 'active' | 'revoked' | 'failed'

// Pooled team GSC credentials. Distinct from core `googleAccounts` —
// `googleAccounts` carries per-user OAuth (used by site sync); this table is
// the team-pool view used by gscdump partner API. Decision deferred to Agent C.
export const teamGscCredentials = sqliteTable('team_gsc_credentials', {
  teamGscCredentialId: integer('team_gsc_credential_id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().$defaultFn(nanoid),
  teamId: integer('team_id').notNull().references(() => teams.teamId, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  // No credential column: the key lives once, on `users.gscdump_api_key`, and
  // this row only records which member the team reads through plus its status.
  // A copy here drifted silently on every repair-driven rotation.
  gscdumpUserId: text('gscdump_user_id').notNull(),
  label: text('label'),
  status: text('status', { enum: ['active', 'revoked', 'failed'] }).$type<TeamGscCredentialStatus>().notNull().default('active'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  teamUserUnq: unique('team_gsc_credentials_team_user_unique').on(t.teamId, t.userId),
}))

// Site groups for portfolio-operator dashboard organization.
export const siteGroups = sqliteTable('site_groups', {
  siteGroupId: integer('site_group_id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().$defaultFn(nanoid),
  teamId: integer('team_id').references(() => teams.teamId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  order: integer('order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// ─── Usage / Events / Errors ─────────────────────────────────────────────────

/**
 * One DataForSEO task per row: what asked for it, what it cost, what the
 * provider said. The account is shared with nuxtseo.com; until this table
 * existed (2026-08-23) the public tools spent credit with no record, and the
 * month's billing export could not be attributed to a caller. Cost is the
 * provider's own measured `cost` from the response envelope, in micro-USD,
 * so sums reconcile against the invoice rather than an estimate.
 */
export const dataforseoRequests = sqliteTable('dataforseo_requests', {
  dataforseoRequestId: integer('dataforseo_request_id').primaryKey({ autoIncrement: true }),
  /** Which public tool or internal path fired the call. */
  tool: text('tool').notNull(),
  /** Provider endpoint path, e.g. `/serp/google/organic/live/advanced`. */
  endpoint: text('endpoint').notNull(),
  /** Tasks in the batch (live endpoints batch up to 100 per request). */
  taskCount: integer('task_count').notNull().default(1),
  /** HTTP status of the provider response. */
  status: text('status', { enum: ['ok', 'http_error'] }).notNull(),
  httpStatus: integer('http_status'),
  /** Measured cost from the envelope, micro-USD. Null when the call failed. */
  costUsdMicros: integer('cost_usd_micros'),
  /** Hashed caller IP for anonymous attribution (tools are unauthenticated). */
  ipHash: text('ip_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  createdIdx: index('dataforseo_requests_created_idx').on(t.createdAt),
  toolCreatedIdx: index('dataforseo_requests_tool_created_idx').on(t.tool, t.createdAt),
}))

export const proEvents = sqliteTable('pro_events', {
  proEventId: integer('pro_event_id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at').notNull(),
}, t => ({
  userTypeIdx: index('pro_events_user_type_idx').on(t.userId, t.type),
}))

export const adminEvents = sqliteTable('admin_events', {
  adminEventId: integer('admin_event_id').primaryKey({ autoIncrement: true }),
  actorUserId: integer('actor_user_id').references(() => users.userId, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
}, t => ({
  kindCreatedIdx: index('admin_events_kind_created_idx').on(t.kind, t.createdAt),
}))

export const runtimeErrors = sqliteTable('runtime_errors', {
  runtimeErrorId: integer('runtime_error_id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at').notNull(),
  level: text('level').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  error: text('error'),
  ctx: text('ctx'),
  requestId: text('request_id'),
  userId: integer('user_id'),
  path: text('path'),
}, t => ({
  nameCreatedIdx: index('runtime_errors_name_created_idx').on(t.name, t.createdAt),
  userCreatedIdx: index('runtime_errors_user_created_idx').on(t.userId, t.createdAt),
  levelCreatedIdx: index('runtime_errors_level_created_idx').on(t.level, t.createdAt),
}))

// Anonymous (CI builds) + pro (licensed) telemetry.
export const telemetryEvents = sqliteTable('telemetry_events', {
  telemetryEventId: integer('telemetry_event_id').primaryKey({ autoIncrement: true }),
  source: text('source', { enum: ['anonymous', 'pro'] }).notNull(),
  projectHash: text('project_hash'),
  siteUrl: text('site_url'),
  userId: integer('user_id').references(() => users.userId, { onDelete: 'set null' }),
  modules: text('modules', { mode: 'json' }).$type<string[]>().notNull(),
  moduleVersions: text('module_versions', { mode: 'json' }).$type<Record<string, string>>(),
  config: text('config', { mode: 'json' }).$type<Record<string, Record<string, boolean | string | number>>>(),
  nuxtVersion: text('nuxt_version'),
  nodeVersion: text('node_version'),
  packageManager: text('package_manager'),
  os: text('os'),
  ci: text('ci'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const notifications = sqliteTable('notifications', {
  notificationId: integer('notification_id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().$defaultFn(nanoid),
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title'),
  body: text('body'),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  userCreatedIdx: index('notifications_user_created_idx').on(t.userId, t.createdAt),
}))

export const feedback = sqliteTable('feedback', {
  feedbackId: integer('feedback_id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull(),
  thumb: text('thumb', { enum: ['up', 'down'] }),
  comment: text('comment'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  userId: integer('user_id').references(() => users.userId, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// ─────────────────────────────────────────────────────────────────────────────
// V1 net-new tables. The boundary that decides what lives here: docs/arch/README.md
// ─────────────────────────────────────────────────────────────────────────────

// Cloudflare Queue mirror of submitted URLs. Distinct from generic `jobs`.
export const indexingJobs = sqliteTable('indexing_jobs', {
  indexingJobId: integer('indexing_job_id').primaryKey({ autoIncrement: true }),
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  transport: text('transport').notNull(), // 'google' | 'bing' | 'yandex' | 'naver' | 'seznam'
  state: text('state').notNull().default('queued'), // 'queued' | 'submitted' | 'accepted' | 'rejected' | 'error'
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  siteStateIdx: index('indexing_jobs_site_state_idx').on(t.siteId, t.state),
  sitePathTransportUnq: unique('indexing_jobs_site_path_transport_unique').on(t.siteId, t.path, t.transport),
}))

// User-tracked investigation status for an indexing issue on a URL. Purely a
// status/note tracker, not a live inspection: recorded when a user marks an
// issue as investigated/fixed/false-positive/etc. Live inspection goes through
// gscdump's `inspect.create` operation separately, not this table.
export const indexingInvestigations = sqliteTable('indexing_investigations', {
  indexingInvestigationId: integer('indexing_investigation_id').primaryKey({ autoIncrement: true }),
  siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  issueType: text('issue_type').notNull(),
  status: text('status').notNull().default('investigated'), // 'investigated' | 'monitoring' | 'false_positive' | 'wont_fix' | 'fixed'
  note: text('note'),
  investigatedAt: integer('investigated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, t => ({
  siteUrlIssueUnq: unique('indexing_investigations_site_url_issue_unique').on(t.siteId, t.url, t.issueType),
  siteIdx: index('indexing_investigations_site_idx').on(t.siteId),
}))

// ─── Relations (pro-saas + V1) ───────────────────────────────────────────────

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, { fields: [userIdentities.userId], references: [users.userId] }),
}))

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, { fields: [teamMemberships.teamId], references: [teams.teamId] }),
  user: one(users, { fields: [teamMemberships.userId], references: [users.userId] }),
}))

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, { fields: [teamInvitations.teamId], references: [teams.teamId] }),
  invitedBy: one(users, { fields: [teamInvitations.invitedById], references: [users.userId] }),
}))

export const teamAuditEventsRelations = relations(teamAuditEvents, ({ one }) => ({
  team: one(teams, { fields: [teamAuditEvents.teamId], references: [teams.teamId] }),
  actor: one(users, { fields: [teamAuditEvents.actorUserId], references: [users.userId] }),
}))

export const teamGscCredentialsRelations = relations(teamGscCredentials, ({ one }) => ({
  team: one(teams, { fields: [teamGscCredentials.teamId], references: [teams.teamId] }),
  user: one(users, { fields: [teamGscCredentials.userId], references: [users.userId] }),
}))

export const siteGroupsRelations = relations(siteGroups, ({ one }) => ({
  team: one(teams, { fields: [siteGroups.teamId], references: [teams.teamId] }),
}))

export const proEventsRelations = relations(proEvents, ({ one }) => ({
  user: one(users, { fields: [proEvents.userId], references: [users.userId] }),
}))

export const adminEventsRelations = relations(adminEvents, ({ one }) => ({
  actor: one(users, { fields: [adminEvents.actorUserId], references: [users.userId] }),
}))

export const telemetryEventsRelations = relations(telemetryEvents, ({ one }) => ({
  user: one(users, { fields: [telemetryEvents.userId], references: [users.userId] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.userId] }),
}))

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.userId] }),
}))

export const indexingJobsRelations = relations(indexingJobs, ({ one }) => ({
  site: one(sites, { fields: [indexingJobs.siteId], references: [sites.id] }),
}))

export const indexingInvestigationsRelations = relations(indexingInvestigations, ({ one }) => ({
  site: one(sites, { fields: [indexingInvestigations.siteId], references: [sites.id] }),
}))

// ─── Type exports ────────────────────────────────────────────────────────────

export type TeamMembership = typeof teamMemberships.$inferSelect
export type TeamInvitation = typeof teamInvitations.$inferSelect
export type TeamAuditEvent = typeof teamAuditEvents.$inferSelect
export type NewTeamAuditEvent = typeof teamAuditEvents.$inferInsert
export type TeamGscCredential = typeof teamGscCredentials.$inferSelect
export type NewTeamGscCredential = typeof teamGscCredentials.$inferInsert
export type SiteGroup = typeof siteGroups.$inferSelect
export type NewSiteGroup = typeof siteGroups.$inferInsert
export type ProEvent = typeof proEvents.$inferSelect
export type NewProEvent = typeof proEvents.$inferInsert
export type AdminEvent = typeof adminEvents.$inferSelect
export type NewAdminEvent = typeof adminEvents.$inferInsert
export type RuntimeError = typeof runtimeErrors.$inferSelect
export type NewRuntimeError = typeof runtimeErrors.$inferInsert
export type TelemetryEvent = typeof telemetryEvents.$inferSelect
export type NewTelemetryEvent = typeof telemetryEvents.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type IndexingJob = typeof indexingJobs.$inferSelect
export type NewIndexingJob = typeof indexingJobs.$inferInsert
export type IndexingInvestigation = typeof indexingInvestigations.$inferSelect
export type NewIndexingInvestigation = typeof indexingInvestigations.$inferInsert
export type NewUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect

// Pro-saas compatibility aliases (text id semantics → integer userId/teamId surfaces)
export type Site = SiteSelect
export type Team = TeamSelect
