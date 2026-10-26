import { computed } from 'vue'
import { useCallerState } from '#layers/pro-saas/app/composables/useCaller'

type QueryIdentity = { _tag: 'Available', scope: string } | { _tag: 'Unavailable', scope: string }

/** Only security fields participate. Caller can lag behind session changes. */
export function useGscQueryIdentity() {
  const caller = useCallerState()
  const { session, loggedIn } = useUserSession()
  return computed<QueryIdentity>((previous) => {
    const userId = session.value?.user?.id
    const active = loggedIn.value && userId != null
    const currentCaller = active && caller.value?.user.id === userId ? caller.value : null
    const teamId = currentCaller?.currentTeamId ?? null
    // A Site can belong to another Team than the last selected Team.
    const memberships = currentCaller?.memberships
      .map(m => [m.teamId, m.role, m.isOwner] as const)
      .sort((a, b) => a[0] - b[0]) ?? []
    const scope = JSON.stringify([
      active,
      userId ?? null,
      session.value?.user?.currentTeamId ?? null,
      teamId,
      currentCaller?.isAdmin ?? false,
      memberships,
    ])
    if (previous?.scope === scope)
      return previous
    return active ? { _tag: 'Available', scope } : { _tag: 'Unavailable', scope }
  })
}
