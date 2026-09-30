// Ported from nuxtseo.com's `layers/saas/app/composables/useProUserMenu.ts`,
// cut to what this app offers: no billing, API tokens, preferences, support
// page, feedback drawer or workspace creation.
//
// Three groups, laid out as two columns plus a full-width footer row:
// Workspace (switch team, team pages), Account (person pages), then Sign out.
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ProWorkspace } from './useCurrentWorkspace'

export interface ProUserMenuItem extends DropdownMenuItem {
  /** Workspace rows render their team avatar instead of a nav icon. */
  workspaceTeam?: ProWorkspace
  /** Marks the currently active workspace row. */
  workspaceActive?: boolean
}

export const proUserMenuUi = {
  content: 'w-64 max-w-[calc(100vw-1.5rem)] border border-accented bg-muted ring-0 lg:w-[28rem]',
  viewport: 'grid grid-cols-1 divide-y-0 lg:grid-cols-2',
  group: 'min-w-0 p-2 border-default [&:nth-child(2)]:border-t lg:[&:nth-child(2)]:border-t-0 lg:[&:nth-child(2)]:border-l last:col-span-full last:border-t last:flex last:flex-col lg:last:flex-row',
  label: 'mb-1 text-xs font-medium tracking-wide text-muted',
  item: 'min-h-11 items-center cursor-pointer lg:min-h-0',
  itemLeadingIcon: 'hidden',
  separator: '-mx-2',
}

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
        toast.add({ title: 'Switch failed', description: err instanceof Error ? err.message : 'Could not switch workspace', color: 'error' })
      })
  }

  const items = computed<ProUserMenuItem[][]>(() => {
    const workspace: ProUserMenuItem[] = [
      { label: teams.value.length > 1 ? 'Workspaces' : 'Workspace', type: 'label' },
      ...teams.value.map<ProUserMenuItem>((team) => {
        const active = team.id === currentTeam.value?.id
        return {
          label: teamLabel(team),
          description: active ? undefined : teamRoleLabel(team.role),
          workspaceTeam: team,
          workspaceActive: active,
          onSelect: () => { void selectWorkspace(team.id) },
        }
      }),
      { type: 'separator' },
      { label: 'General', icon: 'settings', to: '/pro/dashboard/team/settings' },
      { label: 'Members', icon: 'users', to: '/pro/dashboard/team/members' },
    ]
    // At one Site the sidebar has no Sites roster and no connect control, so
    // growing to a second Site lives here, as upstream does.
    if (toValue(options.singleSite) && can('manage-sites')) {
      workspace.push(
        { type: 'separator' },
        { label: 'Connect a Site', icon: 'add', to: '/pro/dashboard/sites/connect' },
      )
    }

    const personal: ProUserMenuItem[] = [
      { label: 'Account', type: 'label' },
      { label: 'Account', icon: 'user', to: '/pro/dashboard/account' },
      // nuxtseo.com's user menu carries "Billing & Usage". The Free allowance
      // is counted per account, so Usage sits with Account here.
      { label: 'Usage', icon: 'gauge', to: '/pro/dashboard/usage' },
      // Always here. The rail carries Integrations only while one is pending.
      { label: 'Integrations', icon: 'plug', to: '/pro/dashboard/integrations' },
      { label: 'Developers', icon: 'terminal', to: '/pro/dashboard/developers' },
    ]

    const signOut: ProUserMenuItem[] = [
      { label: 'Sign out', icon: 'log-out', to: '/auth/logout', external: true },
    ]

    return [workspace, personal, signOut]
  })

  return { items, menuUi: proUserMenuUi }
}
