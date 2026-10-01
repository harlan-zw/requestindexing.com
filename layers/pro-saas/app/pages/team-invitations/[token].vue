<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => route.params.token as string)

const { loggedIn, session } = useUserSession()
const toast = useToast()

const { data, error, pending } = await useFetch<{
  invitation: {
    id: string
    email: string
    role: 'admin' | 'editor' | 'viewer'
    expired: boolean
    accepted: boolean
    team: { id: string, name: string, personalTeam: boolean }
    invitedBy: { name?: string | null, email?: string | null }
  }
}>(() => `/api/pro/invitations/${token.value}`, { key: () => `invite-${token.value}` })

useSeoMeta({
  title: () => data.value
    ? `You're invited to ${data.value.invitation.team.name}`
    : 'Invitation',
  robots: 'noindex',
})

const inv = computed(() => data.value?.invitation)
const inviterName = computed(() =>
  inv.value?.invitedBy.name
  || inv.value?.invitedBy.email
  || 'A teammate',
)

const sessionEmail = computed(() => session.value?.user?.email ?? null)
const wrongAccount = computed(() => {
  if (!loggedIn.value || !inv.value || !sessionEmail.value)
    return false
  return inv.value.email.toLowerCase() !== sessionEmail.value.toLowerCase()
})

const accepting = ref(false)
async function accept() {
  if (accepting.value)
    return
  accepting.value = true
  try {
    await $fetch<{ teamId: string }>('/api/pro/invitations/accept', {
      method: 'POST',
      body: { token: token.value },
    })
    toast.add({ title: 'Welcome to the team', color: 'success' })
    // As nuxtseo.com does: a full load of the dashboard, so the session it
    // renders carries the Team this invitation joined. The old target,
    // `/pro/dashboard/teams/:id/settings`, names no page in this app.
    await navigateTo('/pro/dashboard', { external: true })
  }
  catch (err: unknown) {
    toast.add({
      title: 'Could not accept',
      description: err instanceof Error ? err.message : 'Unknown error',
      color: 'error',
    })
  }
  finally {
    accepting.value = false
  }
}

async function switchAccount() {
  // Logout, then redirect back here so the user signs in with the right email.
  await navigateTo(`/auth/logout?redirect=/team-invitations/${token.value}`, { external: true })
}

function decline() {
  navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen bg-default flex items-center justify-center px-4 py-12">
    <ProCard variant="default" class="w-full max-w-md">
      <div v-if="pending" class="py-8 flex justify-center">
        <UiSkeleton class="w-3/4 h-6" />
      </div>

      <div v-else-if="error || !inv" class="py-6 text-center">
        <ProNavIcon icon="i-lucide-mail-x" class="mx-auto" />
        <h1 class="mt-4 text-lg font-medium text-default">
          Invitation not found
        </h1>
        <p class="mt-2 text-sm text-muted">
          This invite may have been revoked. Ask your teammate to send a new one.
        </p>
        <UButton class="mt-6" to="/" variant="ghost" color="neutral" label="Go home" />
      </div>

      <!-- T3.2 expired -->
      <div v-else-if="inv.expired" class="py-6 text-center">
        <ProNavIcon icon="i-lucide-clock" class="mx-auto" />
        <h1 class="mt-4 text-lg font-medium text-default">
          This invitation has expired
        </h1>
        <p class="mt-2 text-sm text-muted">
          Invites are valid for 7 days. Ask {{ inviterName }} to send a new one.
        </p>
        <UButton class="mt-6" to="/" variant="ghost" color="neutral" label="Go home" />
      </div>

      <!-- accepted already -->
      <div v-else-if="inv.accepted" class="py-6 text-center">
        <ProNavIcon icon="i-lucide-check-circle-2" class="mx-auto" />
        <h1 class="mt-4 text-lg font-medium text-default">
          Invitation already accepted
        </h1>
        <UButton
          class="mt-6"
          to="/pro/dashboard"
          color="primary"
          label="Go to team"
        />
      </div>

      <!-- Valid: T3.1 logged-in matching, T3.3 wrong-account, or logged-out -->
      <div v-else>
        <div class="text-center">
          <ProNavIcon icon="i-lucide-users" class="mx-auto" />
          <h1 class="mt-4 text-lg font-medium text-default">
            <span class="font-semibold">{{ inviterName }}</span>
            invited you to
            <span class="font-semibold">{{ inv.team.name }}</span>
          </h1>
          <div class="mt-3 flex items-center justify-center gap-2">
            <span class="text-[13px] text-dimmed">Role:</span>
            <UBadge variant="outline" color="neutral" size="xs">
              {{ inv.role }}
            </UBadge>
          </div>
        </div>

        <!-- T3.3 wrong-account -->
        <ProAlert
          v-if="loggedIn && wrongAccount"
          class="mt-6"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Wrong account"
          :description="`This invite is for ${inv.email}. You're signed in as ${sessionEmail}.`"
        >
          <template #actions>
            <UButton color="warning" variant="subtle" label="Switch account" @click="switchAccount" />
          </template>
        </ProAlert>

        <!-- not logged in -->
        <ProAlert
          v-else-if="!loggedIn"
          class="mt-6"
          color="info"
          icon="i-lucide-log-in"
          title="Sign in to accept"
          :description="`Sign in with ${inv.email} to join the team.`"
        >
          <template #actions>
            <UButton :to="`/auth/github?redirect=/team-invitations/${token}`" color="info" variant="subtle" label="Sign in" />
          </template>
        </ProAlert>

        <!-- T3.1 valid + matching -->
        <div v-else class="flex justify-end gap-2 mt-6">
          <UButton variant="ghost" color="neutral" label="Decline" @click="decline" />
          <UButton color="primary" label="Accept invitation" :loading="accepting" @click="accept" />
        </div>
      </div>
    </ProCard>
  </div>
</template>
