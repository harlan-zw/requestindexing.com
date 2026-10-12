import type { AccountStatus } from '@gscdump/contracts'

type Parse = (value: unknown) => unknown
const accountStatuses: ReadonlySet<unknown> = new Set(['disconnected', 'oauth_received', 'scope_missing', 'refresh_missing', 'db_provisioning', 'ready', 'reauth_required'] as const satisfies readonly AccountStatus[])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const nullableString: Parse = value => value === null || typeof value === 'string' ? value : undefined
const boolean: Parse = value => typeof value === 'boolean' ? value : undefined
const identityId: Parse = value => (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  || (typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0)
  ? value
  : undefined
const nullableId: Parse = value => value === null ? null : identityId(value)

function pick(source: Record<string, unknown>, fields: Record<string, Parse>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const [key, parse] of Object.entries(fields)) {
    const value = parse(source[key])
    if (value !== undefined)
      picked[key] = value
  }
  return picked
}

const USER_FIELDS = {
  email: nullableString,
  name: nullableString,
  avatarUrl: nullableString,
  authProvider: value => value === 'github' || value === 'google' ? value : undefined,
  currentTeamId: nullableId,
} satisfies Record<string, Parse>

const SESSION_FIELDS = {
  team: (value) => {
    if (value === null)
      return null
    if (!isRecord(value) || identityId(value.teamId) === undefined || typeof value.name !== 'string' || typeof value.personalTeam !== 'boolean')
      return undefined
    return { teamId: value.teamId, name: value.name, personalTeam: value.personalTeam }
  },
  onboardingCompletedAt: nullableString,
  deliveryEmail: nullableString,
  hasSites: boolean,
  gscConnected: boolean,
  gscEmail: nullableString,
  googleScopes: nullableString,
  gscIndexingScope: boolean,
  gscSitemapsScope: boolean,
  gscdumpUserId: nullableString,
  gscdumpConnected: boolean,
  gscdumpAccountStatus: value => value === null || accountStatuses.has(value) ? value : undefined,
} satisfies Record<string, Parse>

/** Browser-visible fields only. Credentials and OAuth state never leave the server. */
export function toClientSession(session: unknown): Record<string, unknown> {
  if (!isRecord(session) || !isRecord(session.user) || identityId(session.user.id) === undefined)
    return {}
  return {
    user: { id: session.user.id, ...pick(session.user, USER_FIELDS) },
    ...pick(session, SESSION_FIELDS),
  }
}
