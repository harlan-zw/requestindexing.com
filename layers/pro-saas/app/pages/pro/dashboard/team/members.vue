<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { InviteRoleOption } from '@nuxtseo/pro-shell/shared/invite'
import type { TeamRole } from '#layers/pro-saas/shared/policies/team-policy'
import ProShellAbilityGate from '@nuxtseo/pro-shell/app/components/ProShellAbilityGate.vue'
import ProShellInviteDialog from '@nuxtseo/pro-shell/app/components/ProShellInviteDialog.vue'
import { useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useClipboard } from '@vueuse/core'
import { invitationCreateSchema } from '#layers/pro-saas/shared/validators/invitations'
import { createTeamInviteAdapter } from '../../../../utils/team-invite'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Members',
  icon: 'i-heroicons-user-group',
  description: 'Manage your team members.',
})

const { data: members, status } = await useFetch('/api/teams/members')

interface MemberRow {
  user: string | null
  avatar: string | null
  email: string | null
  role: string
}

const rows = computed<MemberRow[]>(() => (members.value || []).map(member => ({
  user: member.user.name,
  avatar: member.user.avatar,
  email: member.user.email,
  role: member.role.replace(/\b\w/g, (c: string) => c.toUpperCase()),
})))

// Explicit columns: the auto-derived set printed the raw `avatar` URL as its own
// column, which forced a horizontal scrollbar. The avatar renders in the User
// cell instead.
const columns: TableColumn<MemberRow>[] = [
  { accessorKey: 'user', header: 'User' },
  { accessorKey: 'role', header: 'Role' },
]

// Invite member, through the shell dialog. The invitation email is not wired
// yet (`team-domain.ts` logs it), so the link a teammate needs comes from the
// Pending invitations list below.
const { caller } = useCaller()
const teamId = computed(() => caller.value?.currentTeamId ?? null)
const proFetch = useProFetch()
const inviteCopy = useProShellCopy().invite
const inviteOpen = ref(false)

interface PendingInvitation { teamInvitationId: number, email: string, role: TeamRole, token: string, expiresAt: string | number }
const { data: pending, refresh: refreshPending } = useLazyFetch<{ invitations: PendingInvitation[] }>(
  () => `/api/pro/teams/${teamId.value}/invitations`,
  { $fetch: proFetch, server: false, immediate: !!teamId.value, watch: [teamId] },
)
const pendingInvitations = computed(() => pending.value?.invitations ?? [])

const roles: InviteRoleOption<TeamRole>[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

const invite = createTeamInviteAdapter({
  send: (email, role) => proFetch(`/api/pro/teams/${teamId.value}/invitations`, { method: 'POST', body: { email, role } }),
  pendingEmails: () => pendingInvitations.value.map(invitation => invitation.email),
})

const origin = useRequestURL().origin
const { copy, copied } = useClipboard({ legacy: true })
const copiedId = ref<number | null>(null)
function copyLink(invitation: PendingInvitation) {
  copiedId.value = invitation.teamInvitationId
  void copy(`${origin}/team-invitations/${invitation.token}`)
}
function roleLabel(role: TeamRole): string {
  return roles.find(option => option.value === role)?.label ?? role
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <ProShellAbilityGate ability="manage-members" :team-id="teamId === null ? null : String(teamId)">
        <UiButton purpose="cta" icon="add" class="min-h-11 lg:min-h-0" @click="inviteOpen = true">
          {{ inviteCopy.action }}
        </UiButton>
      </ProShellAbilityGate>
    </div>

    <UTable :data="rows" :columns="columns" :loading="status === 'pending'">
      <template #user-cell="{ row }">
        <div class="flex items-center gap-2">
          <UAvatar :src="row.original.avatar ?? undefined" :alt="row.original.user ?? row.original.email ?? 'Member'" />
          <div>
            <div>{{ row.original.user }}</div>
            <div class="text-xs text-muted">
              {{ row.original.email }}
            </div>
          </div>
        </div>
      </template>
      <template #role-cell="{ row }">
        <UBadge :color="row.original.role === 'Owner' ? 'primary' : 'neutral'" variant="subtle">
          {{ row.original.role }}
        </UBadge>
      </template>
    </UTable>

    <section v-if="pendingInvitations.length" class="space-y-2" aria-labelledby="pending-invitations">
      <h2 id="pending-invitations" class="text-sm font-medium text-highlighted">
        Pending invitations
      </h2>
      <ul class="divide-y divide-default rounded-md border border-default">
        <li v-for="invitation in pendingInvitations" :key="invitation.teamInvitationId" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div class="min-w-0">
            <p class="truncate text-sm text-default">
              {{ invitation.email }}
            </p>
            <p class="text-xs text-muted">
              {{ roleLabel(invitation.role) }}
            </p>
          </div>
          <UiButton size="sm" purpose="secondary" icon="copy" class="min-h-11 lg:min-h-0" @click="copyLink(invitation)">
            {{ copied && copiedId === invitation.teamInvitationId ? 'Link copied' : 'Copy invitation link' }}
          </UiButton>
        </li>
      </ul>
    </section>

    <ProShellInviteDialog
      v-model:open="inviteOpen"
      :invite="invite"
      :roles="roles"
      default-role="editor"
      :schema="invitationCreateSchema"
      @invited="() => refreshPending()"
    />
  </div>
</template>
