// The user menu groups `ProShellUserMenu` draws, ported from nuxtseo.com's
// `useProUserMenu` and cut to what this app offers: no billing, API tokens,
// preferences or workspace creation.
//
// Three groups, laid out as two columns plus a full-width footer row:
// Team (switch Team, Team pages), Account (person pages), then Send feedback
// and Sign out.
import type { ProShellUserMenuItem } from '@nuxtseo/pro-shell/shared/user-menu'

export function useProUserMenu(options: { singleSite: MaybeRefOrGetter<boolean> }) {
  const toast = useToast()
  const { teams, currentTeam, currentTeamId, teamLabel, teamRoleLabel, switchTeam } = useCurrentWorkspace()
  const { can } = useTeamPolicy(currentTeamId)

  async function selectWorkspace(teamId: number) {
    if (teamId === currentTeam.value?.id)
      return
    await switchTeam(teamId)
      .then(async () => { await navigateTo('/pro/dashboard', { external: true }) })
      .catch((err: unknown) => {
        toast.add({ title: 'Switch failed', description: err instanceof Error ? err.message : 'Could not switch team', color: 'error' })
      })
  }

  const items = computed<ProShellUserMenuItem[][]>(() => {
    const workspace: ProShellUserMenuItem[] = [
      { label: teams.value.length > 1 ? 'Teams' : 'Team', type: 'label' },
      ...teams.value.map<ProShellUserMenuItem>((team) => {
        const active = team.id === currentTeam.value?.id
        return {
          label: teamLabel(team),
          description: active ? undefined : teamRoleLabel(team.role),
          team: { id: String(team.id), name: team.name, personalTeam: team.personalTeam },
          active,
          onSelect: () => { void selectWorkspace(team.id) },
        }
      }),
      { type: 'separator' },
      { label: 'General', icon: 'settings', to: '/pro/dashboard/team/settings' },
      { label: 'Members', icon: 'users', action: { _tag: 'Route', name: 'teamMembers' } },
    ]
    // At one Site the sidebar has no Sites roster and no connect control, so
    // growing to a second Site lives here, as upstream does.
    if (toValue(options.singleSite) && can('manage-sites')) {
      workspace.push(
        { type: 'separator' },
        { label: 'Connect a Site', icon: 'add', action: { _tag: 'Route', name: 'addSite' } },
      )
    }

    const personal: ProShellUserMenuItem[] = [
      { label: 'Account', type: 'label' },
      { label: 'Account', icon: 'user', to: '/pro/dashboard/account' },
      // nuxtseo.com's user menu carries "Billing & Usage". The Free allowance
      // is counted per account, so Usage sits with Account here.
      { label: 'Usage', icon: 'gauge', to: '/pro/dashboard/usage' },
      // Always here. The rail carries Integrations only while one is pending.
      { label: 'Integrations', icon: 'plug', action: { _tag: 'Route', name: 'integrations' } },
      { label: 'Developers', icon: 'terminal', action: { _tag: 'Route', name: 'developers' } },
    ]

    const footer: ProShellUserMenuItem[] = [
      { icon: 'message', action: { _tag: 'Feedback' } },
      // A full page load, so the session cookie clears before the next render.
      { label: 'Sign out', icon: 'log-out', onSelect: () => { void navigateTo('/auth/logout', { external: true }) } },
    ]

    return [workspace, personal, footer]
  })

  return { items }
}
