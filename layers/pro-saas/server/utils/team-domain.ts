// Team domain: deep module wrapping a Team row plus closures bound to db/event.
// Callers obtain a TeamWithOps via requireCurrentTeam and invoke verbs as methods
// on the team itself (e.g. ctx.team.audit(...), ctx.team.sendInvite(...)).
// See CONTEXT.md and docs/adr/0002-caller-is-the-user-context-seam.md.

import type { H3Event } from 'h3'
import type { AuthIdentityRow } from '#layers/pro-saas-auth/shared/types/auth'
import type { Team, TeamAuditEventKind } from '../database'
import { and, eq, exists, gte, inArray, isNull, sql } from 'drizzle-orm'
import { logWarn } from '~~/shared/logging'
import { logger } from '~~/shared/server/logger'
import { dispatchEvent } from '#domain-events/server'
import { teamAuditEvents, teamInvitations, teamMemberships, userIdentities, users } from '../database'

// `sendEmail` from the upstream host was deleted during port. Stub to a logger
// call until request-indexing wires Postmark (already a dep in package.json).
async function sendEmail(_event: H3Event, opts: { to: string, subject: string, html: string }) {
  console.warn('[email.send_stub]', { to: opts.to, subject: opts.subject })
}

export interface AuditOpts {
  actorUserId: number | null
  kind: TeamAuditEventKind
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

export interface RecordTeamAuditEventOpts extends AuditOpts {
  db: ReturnType<typeof useDrizzle>
  teamId: number
}

/**
 * Best-effort audit insert for callers that don't have a TeamWithOps in hand
 * (e.g. invite-acceptance flow before the user is a member). Prefer
 * `team.audit(...)` from a TeamWithOps when available.
 */
export async function recordTeamAuditEvent(opts: RecordTeamAuditEventOpts): Promise<void> {
  await opts.db.insert(teamAuditEvents).values({
    teamId: opts.teamId,
    actorUserId: opts.actorUserId,
    kind: opts.kind,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    metadata: opts.metadata ?? null,
  }).catch((err: unknown) => {
    logger.error('[team-audit] insert failed:', err instanceof Error ? err.message : String(err))
  })
}

export type TeamInvitationAcceptance
  = | { _tag: 'Accepted', teamId: number }
    | { _tag: 'Rejected', reason: 'not-found' | 'already-accepted' | 'expired' | 'changed' }
    | { _tag: 'WrongAccount', email: string }

export async function acceptTeamInvitation(
  event: H3Event,
  input: { db: ReturnType<typeof useDrizzle>, token: string, userId: number, identities: ReadonlyArray<Pick<AuthIdentityRow, 'email' | 'emailVerified'>>, now: number },
): Promise<TeamInvitationAcceptance> {
  const { db } = input
  const invitation = await db.select().from(teamInvitations).where(eq(teamInvitations.token, input.token)).get()
  if (!invitation)
    return { _tag: 'Rejected', reason: 'not-found' }
  if (invitation.acceptedAt !== null)
    return { _tag: 'Rejected', reason: 'already-accepted' }
  const acceptedAt = new Date(input.now)
  if (invitation.expiresAt < acceptedAt)
    return { _tag: 'Rejected', reason: 'expired' }
  const matchingEmails = input.identities.flatMap(({ email, emailVerified }) =>
    emailVerified && email && email.toLowerCase() === invitation.email.toLowerCase() ? [email] : [],
  )
  if (!matchingEmails.length)
    return { _tag: 'WrongAccount', email: invitation.email }

  // Each write gates the next through changes(). A lost claim changes no other row.
  // D1 commits the batch atomically, so a failed grant also releases the claim.
  const [accepted, , memberships] = await db.batch([
    db.update(teamInvitations)
      .set({ acceptedAt })
      .where(and(
        eq(teamInvitations.teamInvitationId, invitation.teamInvitationId),
        eq(teamInvitations.token, input.token),
        eq(teamInvitations.teamId, invitation.teamId),
        eq(teamInvitations.role, invitation.role),
        eq(teamInvitations.email, invitation.email),
        isNull(teamInvitations.acceptedAt),
        gte(teamInvitations.expiresAt, acceptedAt),
        exists(db.select({ userId: users.userId }).from(users).where(eq(users.userId, input.userId))),
        exists(db.select({ userId: userIdentities.userId }).from(userIdentities).where(and(
          eq(userIdentities.userId, input.userId),
          eq(userIdentities.emailVerified, true),
          inArray(userIdentities.email, matchingEmails),
        ))),
      ))
      .returning({ id: teamInvitations.teamInvitationId }),
    db.update(users)
      .set({ currentTeamId: invitation.teamId, updatedAt: input.now })
      .where(and(eq(users.userId, input.userId), sql`changes() = 1`)),
    db.insert(teamMemberships)
      .select(db.select({
        teamMembershipId: sql<number | null>`NULL`.as('team_membership_id'),
        teamId: teamInvitations.teamId,
        userId: sql<number>`${input.userId}`.as('user_id'),
        role: teamInvitations.role,
        firstVisitDismissedAt: sql<Date | null>`NULL`.as('first_visit_dismissed_at'),
        createdAt: sql<Date>`${Math.floor(input.now / 1000)}`.as('created_at'),
        updatedAt: sql<Date>`${Math.floor(input.now / 1000)}`.as('updated_at'),
      }).from(teamInvitations).where(and(
        eq(teamInvitations.teamInvitationId, invitation.teamInvitationId),
        eq(teamInvitations.token, input.token),
        eq(teamInvitations.acceptedAt, acceptedAt),
        sql`changes() = 1`,
      )))
      .onConflictDoNothing({ target: [teamMemberships.teamId, teamMemberships.userId] })
      .returning({ id: teamMemberships.teamMembershipId }),
  ])
  if (!accepted.length)
    return { _tag: 'Rejected', reason: 'changed' }

  await recordTeamAuditEvent({
    db,
    teamId: invitation.teamId,
    actorUserId: input.userId,
    kind: 'invitation.accepted',
    targetType: 'invitation',
    targetId: String(invitation.teamInvitationId),
    metadata: { email: invitation.email, role: invitation.role },
  })
  if (memberships.length) {
    await dispatchEvent('pro:membership:added', {
      event,
      teamId: invitation.teamId,
      userId: input.userId,
      role: invitation.role,
    }).catch((err: unknown) => logWarn('webhook.side_effect_failed', err, { event: 'pro:membership:added' }))
  }
  return { _tag: 'Accepted', teamId: invitation.teamId }
}

export interface SendInviteOpts {
  email: string
  role: 'admin' | 'editor' | 'viewer'
  inviterName: string
  acceptUrl: string
  expiresAt: Date
  invitationId: number
}

export interface TeamOps {
  audit: (opts: AuditOpts) => Promise<void>
  sendInvite: (opts: SendInviteOpts) => Promise<void>
}

export type TeamWithOps = Team & TeamOps

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

interface RenderInviteOpts {
  inviterName: string
  teamName: string
  role: 'admin' | 'editor' | 'viewer'
  acceptUrl: string
  expiresAt: Date
}

function renderInviteEmail(opts: RenderInviteOpts): { subject: string, html: string } {
  const expiresLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(opts.expiresAt)
  const subject = `${opts.inviterName} invited you to ${opts.teamName} on Nuxt SEO Pro`

  const html = `<!doctype html>
<html>
<body style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#fafafa;margin:0;padding:32px 16px;color:#111">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden">
    <tr>
      <td style="padding:32px 32px 8px">
        <div style="font-size:14px;color:#666;margin-bottom:8px">Nuxt SEO Pro</div>
        <h1 style="margin:0;font-size:20px;line-height:1.3;color:#111">
          ${escHtml(opts.inviterName)} invited you to <strong>${escHtml(opts.teamName)}</strong>
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 24px">
        <p style="margin:8px 0 0;font-size:14px;color:#444;line-height:1.6">
          You've been invited to join the team as <strong>${escHtml(opts.role)}</strong>.
          Click the button below to accept. This invitation expires on ${escHtml(expiresLabel)}.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px">
        <a href="${escHtml(opts.acceptUrl)}"
           style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;font-size:14px">
          Accept invitation
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px;border-top:1px solid #eee">
        <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.6">
          If the button doesn't work, paste this link into your browser:<br>
          <span style="font-family:ui-monospace,monospace;color:#666;word-break:break-all">${escHtml(opts.acceptUrl)}</span>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888">
          If you weren't expecting this, you can ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

/**
 * Wrap a Team row with operations bound to db/event. Closures hold references
 * but no shared mutable state — safe across concurrent requests.
 */
export function attachTeamOps(
  team: Team,
  deps: { db: ReturnType<typeof useDrizzle>, event: H3Event },
): TeamWithOps {
  const { db, event } = deps

  const audit: TeamOps['audit'] = opts => recordTeamAuditEvent({ db, teamId: team.teamId, ...opts })

  const sendInvite: TeamOps['sendInvite'] = async (opts) => {
    const { subject, html } = renderInviteEmail({
      inviterName: opts.inviterName,
      teamName: team.name,
      role: opts.role,
      acceptUrl: opts.acceptUrl,
      expiresAt: opts.expiresAt,
    })
    // Best-effort: failing email shouldn't roll back invitation row; user can resend or copy link.
    await sendEmail(event, { to: opts.email, subject, html }).catch((err: { message?: string } | undefined) => {
      logWarn('email.send_failed', err, { stage: 'team_invite' })
    })
  }

  return Object.assign(Object.create(null) as Team, team, { audit, sendInvite }) as TeamWithOps
}
